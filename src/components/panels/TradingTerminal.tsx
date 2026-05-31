import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { projects } from "@/data/projects";
import { repoStats } from "@/data/repoStats.generated";
import { aisleScroll } from "@/scene/aisleScroll";
import type { ActivePanel } from "@/scene/activePanel";
import { useSceneVariant } from "@/scene/sceneVariant";
import { SESSION_START_MS } from "@/scene/sessionStart";
import { getTrack, TRACKS, type TrackId } from "@/components/useAisleAudio";
import { PanelShell } from "./PanelShell";

interface TradingTerminalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: ActivePanel) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  trackId: TrackId;
  onSelectTrack: (id: TrackId) => void;
}

// The terminal panel is the site's "control console": a hybrid
// dashboard + command prompt. Dashboard widgets surface live state
// (build SHA, scroll telemetry, audio, repo activity); the prompt at
// the bottom drives navigation + toggles via typed commands. The
// OCaml LOB demo that used to anchor the panel is gone — the OCaml
// LOB rack has its own ProjectCard.

// Mirrors ServerRoom.tsx's AISLE_ORDER. Duplicated rather than imported
// because that module pulls three.js; the terminal panel must stay in
// its own light chunk so the initial bundle doesn't grow.
const AISLE_ORDER = [
  "ocaml-lob",
  "qforge",
  "econos",
  "staija",
  "studysprint",
  "micromatch",
  "capitol-alpha",
  "datafest-2026",
  "linuxbenchhub",
] as const;

const AISLE_SPACING = 2.6;
const AISLE_Z_START = 1.0;
const SCROLL_CAM_Z_START = 8.5;
const SCROLL_CAM_Z_END = -16.0;

// Map a scroll progress (0..1) to the closest rack the user can
// currently see in the aisle. Uses the same "ahead > 3.7" visibility
// gate as the rack labels in ServerRoom.tsx — keeps the widget in
// sync with what the user actually sees on screen.
function dominantRackId(progress: number): string | null {
  const camZ = SCROLL_CAM_Z_START + (SCROLL_CAM_Z_END - SCROLL_CAM_Z_START) * progress;
  let best: { id: string; ahead: number } | null = null;
  for (let i = 0; i < AISLE_ORDER.length; i++) {
    const rackZ = AISLE_Z_START - i * AISLE_SPACING - 1;
    const ahead = camZ - rackZ;
    if (ahead < 3.7 || ahead > 14) continue;
    if (!best || ahead < best.ahead) {
      best = { id: AISLE_ORDER[i], ahead };
    }
  }
  return best?.id ?? null;
}

// Compact "Xs / Xm / Xh / Xd / Xmo" relative-time formatter for the
// build-time + repo-activity widgets. Avoids pulling in date-fns just
// for this one usage.
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

// MM:SS for sessions under an hour, HH:MM:SS once a visitor crosses an
// hour mark. Used by the landscape SESSION uptime widget.
function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

type LogEntry = {
  kind: "input" | "output" | "system" | "error" | "ok" | "banner";
  text: string;
};

const SHORT_SHA = __BUILD_SHA__;
const BUILD_MESSAGE = __BUILD_MESSAGE__;
const BUILD_TIMESTAMP = __BUILD_TIMESTAMP__;

// Initial console contents. A tiny ASCII glyph mark on the first line
// signals "this isn't just a chat box" the moment the panel opens; the
// build / boot lines below give the user something to *read* before
// they start typing instead of a near-empty void with one hint line.
const INITIAL_LOG: LogEntry[] = [
  { kind: "banner", text: " ╭─◇ control_console ◇─╮" },
  { kind: "banner", text: " │  ov @ portfolio    │" },
  { kind: "banner", text: " ╰────────────────────╯" },
  { kind: "system", text: `boot: build ${SHORT_SHA}` },
  { kind: "system", text: "audio synth + aisleScroll attached." },
  { kind: "system", text: "ready. type 'help' for commands." },
  // Subtle nudge that secrets exist. Doesn't list any of them.
  { kind: "system", text: "(some commands are not in 'help'. try old-school unix.)" },
];

// Keys of every hidden command — used by the `secrets` meta-command to
// report progress, and gates persistence (localStorage entries for keys
// not in this list get pruned on load so removed-in-newer-builds entries
// don't permanently count toward your total).
const SECRET_KEYS = [
  "whoami",
  "ls",
  "date",
  "uptime",
  "history",
  "pwd",
  "uname",
  "sudo",
  "rm",
  "editor",
  "coffee",
  "tea",
  "make",
  "greet",
  "exit",
  "42",
  "matrix",
  "wave",
  "konami",
  "xyzzy",
  "iddqd",
  "ascii",
  "cowsay",
  "fortune",
  "stats",
  "credits",
] as const;

// Visible-command names tab-completion suggests on the first token.
// Secret commands are kept *out* of this list so Tab can't be used to
// brute-force discover hidden commands; once a secret has been
// triggered we add its aliases (see SECRET_TO_ALIASES) so the user
// can tab-complete back to it on future sessions.
const VISIBLE_COMMANDS = [
  "help",
  "clear",
  "about",
  "open",
  "goto",
  "home",
  "end",
  "scroll",
  "mute",
  "unmute",
  "secrets",
];

const SECRET_TO_ALIASES: Record<string, string[]> = {
  whoami:  ["whoami"],
  ls:      ["ls", "dir"],
  pwd:     ["pwd"],
  date:    ["date"],
  uptime:  ["uptime"],
  history: ["history"],
  uname:   ["uname"],
  sudo:    ["sudo"],
  rm:      ["rm"],
  editor:  ["vim", "vi", "emacs", "nano", "ed"],
  coffee:  ["coffee"],
  tea:     ["tea"],
  make:    ["make"],
  greet:   ["hello", "hi", "hey", "yo"],
  exit:    ["exit", "quit", "q", "bye"],
  "42":    ["42"],
  matrix:  ["matrix"],
  wave:    ["wave"],
  konami:  ["konami"],
  xyzzy:   ["xyzzy"],
  iddqd:   ["iddqd"],
  ascii:   ["ascii", "logo"],
  cowsay:  ["cowsay"],
  fortune: ["fortune"],
  stats:   ["stats"],
  credits: ["credits"],
};

// Second-token completion targets when the first token is `open` or
// `goto`. Mixes the project ids (the obvious case) with the four
// special keywords those commands also accept.
const GOTO_TARGETS = [
  "contact",
  "entrance",
  "end",
  "terminal",
];

const SECRETS_STORAGE_KEY = "ov_console_secrets_v1";

function loadDiscoveredSecrets(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SECRETS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is string => typeof k === "string" && SECRET_KEYS.includes(k as typeof SECRET_KEYS[number])));
  } catch {
    return new Set();
  }
}

function saveDiscoveredSecrets(secrets: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify([...secrets]));
  } catch {
    // Quota / private-mode failures are non-fatal — secrets just don't persist.
  }
}

// Random fortune lines for the `fortune` command.
const FORTUNES = [
  "the cake is a lie.",
  "write tests. then write the code. or just guess.",
  "if at first you don't succeed, blame the cache.",
  "premature abstraction is the root of all evil.",
  "the best code is no code at all.",
  "you cannot grep dead trees.",
  "RTFM — read the friendly manual.",
  "weeks of coding can save you hours of planning.",
  "real artists ship.",
  "there are two hard problems in computer science: cache invalidation, naming things, and off-by-one errors.",
];

// Big "OV" block letters for the `ascii` command.
const ASCII_BANNER = [
  " ██████╗ ██╗   ██╗",
  "██╔═══██╗██║   ██║",
  "██║   ██║██║   ██║",
  "██║   ██║╚██╗ ██╔╝",
  "╚██████╔╝ ╚████╔╝ ",
  " ╚═════╝   ╚═══╝  ",
];

// Six rows of pseudo-random katakana / hex for the `matrix` rain effect.
const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF";
function matrixLine(width = 36): string {
  let s = "";
  for (let i = 0; i < width; i++) {
    s += MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
  }
  return s;
}

export function TradingTerminal({
  open,
  onClose,
  onNavigate,
  audioEnabled,
  onToggleAudio,
  trackId,
  onSelectTrack,
}: TradingTerminalProps) {
  // Subscribe to the virtual aisle-scroll progress so the telemetry
  // widget updates in real time as the user scrolls the corridor.
  // Subscription is set up unconditionally — the cost is one cheap
  // setState per scroll tick, and there's no observable redundancy
  // when the panel is closed.
  const [progress, setProgress] = useState(() => aisleScroll.progress);
  useEffect(() => aisleScroll.subscribe(setProgress), []);

  const activeRackId = useMemo(() => dominantRackId(progress), [progress]);
  const activeRack = useMemo(
    () => (activeRackId ? projects.find((p) => p.id === activeRackId) ?? null : null),
    [activeRackId],
  );

  // The aisleScroll-driven telemetry only does anything in portrait
  // mode (virtual scrollytelling). In landscape (orbit camera) the
  // scroll never moves, so the telemetry pill perpetually showed 0%
  // and pinned to whichever rack was at slot 0 — a misleading "click
  // to jump" button that always went to the same place. The variant
  // flag below routes the pill to a SESSION uptime read instead, which
  // has a real signal in landscape (it ticks forward).
  const variant = useSceneVariant();

  // Live session uptime tick. SESSION_START_MS is captured at module
  // load (see src/scene/sessionStart.ts) so the value reflects the
  // whole site visit, not just panel-open time. The interval only
  // runs while the panel is open + landscape — there's no display in
  // portrait, so no reason to re-render.
  const [uptimeMs, setUptimeMs] = useState(() => Date.now() - SESSION_START_MS);
  useEffect(() => {
    if (!open || variant !== "landscape") return;
    const id = window.setInterval(() => {
      setUptimeMs(Date.now() - SESSION_START_MS);
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, variant]);

  // Track switcher derived state.
  const currentTrack = getTrack(trackId);
  const trackIndex = TRACKS.findIndex((t) => t.id === trackId);
  const nextTrack = TRACKS[(trackIndex + 1) % TRACKS.length];
  const prevTrack = TRACKS[(trackIndex - 1 + TRACKS.length) % TRACKS.length];

  // Console state. The log scrolls inside a fixed-height container; the
  // input is uncontrolled-via-ref + cycles through past inputs on
  // ArrowUp/ArrowDown.
  const [log, setLog] = useState<LogEntry[]>(INITIAL_LOG);
  const [input, setInput] = useState("");
  const inputHistory = useRef<string[]>([]);
  const historyCursor = useRef<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Discovered secrets ride along in a ref so triggering one doesn't
  // re-render the whole panel. Persists across sessions via
  // localStorage; the `secrets` meta-command reads .size to report
  // progress.
  const discoveredSecrets = useRef<Set<string>>(loadDiscoveredSecrets());
  const markSecret = useCallback((key: string) => {
    if (!SECRET_KEYS.includes(key as typeof SECRET_KEYS[number])) return;
    if (discoveredSecrets.current.has(key)) return;
    discoveredSecrets.current.add(key);
    saveDiscoveredSecrets(discoveredSecrets.current);
  }, []);

  // Heartbeat that increments every 30 s while the panel is open. We
  // don't read its value anywhere — its only job is to trigger a
  // re-render so relativeTime() calls (build "Xm ago", repo "Xd ago")
  // recompute against the new Date.now(). Cheap, runs only while
  // visible.
  const [, setHeartbeat] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setHeartbeat((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  // Which widget should flash this frame. A typed command sets it to
  // "telemetry" or "audio", a 600 ms timeout clears it. The chosen
  // widget renders with the --flash class which runs a one-shot CSS
  // glow animation, giving the prompt visible coupling to the
  // dashboard.
  const [flashedWidget, setFlashedWidget] = useState<"telemetry" | "audio" | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const flashWidget = useCallback((key: "telemetry" | "audio") => {
    setFlashedWidget(key);
    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashedWidget(null);
      flashTimeoutRef.current = null;
    }, 600);
  }, []);
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  // Auto-focus the prompt when the panel opens — the user almost
  // certainly wants to start typing. `preventScroll: true` matters
  // because the input is below the dashboard + repo list; without
  // it the browser scroll-into-views the input and the aisle map
  // ends up clipped above the panel body's scroll region.
  //
  // Skipped on touch-primary devices (phones / tablets) so the soft
  // keyboard doesn't pop the instant the panel opens — the user
  // might just want to *read* the dashboard. They can still focus
  // by tapping the input row. Desktop keeps the auto-focus because
  // "type immediately" is the expected flow there.
  useEffect(() => {
    if (!open) return;
    const isTouchPrimary =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches;
    if (!isTouchPrimary) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  // Auto-scroll the log to the latest entry whenever it grows.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Timer ids for long-running animated commands (currently just the
  // sudo-sandwich ceremony). Cleared on unmount so a pending beat
  // doesn't try to setState on a torn-down component.
  const animationTimersRef = useRef<number[]>([]);
  useEffect(() => {
    const timers = animationTimersRef.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
    };
  }, []);

  // Stream a multi-line apt-install-style "ceremony" into the log as
  // a reward for the user who finds `sudo make me a sandwich`. Each
  // beat appends one LogEntry after a cumulative delay so the output
  // arrives the way a real terminal would render it — not as a wall
  // of text on the same tick.
  const playSandwichCeremony = useCallback(() => {
    const beats: Array<{ delay: number; entry: LogEntry }> = [
      { delay: 180, entry: { kind: "system", text: "[sudo] password for ov: ••••••••••" } },
      { delay: 400, entry: { kind: "output", text: "reading pantry lists...      done" } },
      { delay: 80,  entry: { kind: "output", text: "building dependency tree...  done" } },
      { delay: 80,  entry: { kind: "output", text: "reading state info...        done" } },
      { delay: 220, entry: { kind: "output", text: "the following NEW packages will be assembled:" } },
      { delay: 80,  entry: { kind: "ok",     text: "  bread lettuce tomato cheese mayo turkey" } },
      { delay: 80,  entry: { kind: "output", text: "0 upgraded, 6 newly assembled, 0 to remove." } },
      { delay: 80,  entry: { kind: "output", text: "need to get 312 kcal of ingredients." } },
      { delay: 260, entry: { kind: "output", text: "get:1 pantry/stable bread       [ok]" } },
      { delay: 100, entry: { kind: "output", text: "get:2 pantry/stable lettuce     [ok]" } },
      { delay: 100, entry: { kind: "output", text: "get:3 pantry/stable tomato      [ok]" } },
      { delay: 100, entry: { kind: "output", text: "get:4 pantry/stable cheese      [ok]" } },
      { delay: 100, entry: { kind: "output", text: "get:5 pantry/stable mayo        [ok]" } },
      { delay: 100, entry: { kind: "output", text: "get:6 pantry/stable turkey      [ok]" } },
      { delay: 220, entry: { kind: "output", text: "assembling sandwich..." } },
      { delay: 160, entry: { kind: "output", text: "  [████████████████] toast      100%" } },
      { delay: 160, entry: { kind: "output", text: "  [████████████████] mayo       100%" } },
      { delay: 160, entry: { kind: "output", text: "  [████████████████] turkey     100%" } },
      { delay: 160, entry: { kind: "output", text: "  [████████████████] cheese     100%" } },
      { delay: 160, entry: { kind: "output", text: "  [████████████████] greens     100%" } },
      { delay: 160, entry: { kind: "output", text: "  [████████████████] top slice  100%" } },
      { delay: 280, entry: { kind: "banner", text: "       _________________" } },
      { delay: 55,  entry: { kind: "banner", text: "      /  . . . . . . .  \\" } },
      { delay: 55,  entry: { kind: "banner", text: "     /___________________\\" } },
      { delay: 55,  entry: { kind: "banner", text: "     |~ ~ ~ ~ ~ ~ ~ ~ ~ ~|" } },
      { delay: 55,  entry: { kind: "banner", text: "     |###################|" } },
      { delay: 55,  entry: { kind: "banner", text: "     |@ @ @ @ @ @ @ @ @ @|" } },
      { delay: 55,  entry: { kind: "banner", text: "     |~ ~ ~ ~ ~ ~ ~ ~ ~ ~|" } },
      { delay: 55,  entry: { kind: "banner", text: "     \\___________________/" } },
      { delay: 300, entry: { kind: "ok",     text: "✓ sandwich ready. bon appétit." } },
      { delay: 120, entry: { kind: "system", text: "1 sandwich assembled. total time: 4.7s. calories: yes." } },
    ];
    let elapsed = 0;
    for (const beat of beats) {
      elapsed += beat.delay;
      const id = window.setTimeout(() => {
        setLog((prev) => [...prev, beat.entry]);
      }, elapsed);
      animationTimersRef.current.push(id);
    }
  }, []);

  const runCommand = useCallback(
    (raw: string): LogEntry[] => {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      const [cmd, ...args] = trimmed.split(/\s+/);
      const c = cmd.toLowerCase();
      const arg = args[0]?.toLowerCase();

      switch (c) {
        case "help":
          return [
            { kind: "output", text: "commands:" },
            { kind: "output", text: "  nav    open <id> | goto <target> | home | end | scroll <0..1>" },
            { kind: "output", text: "  audio  mute | unmute" },
            { kind: "output", text: "  meta   about | help | clear | secrets" },
            { kind: "system", text: "(tab completes commands + project ids. more commands hidden.)" },
          ];
        case "clear":
          return [{ kind: "system", text: "__clear__" }];
        case "about":
          return [
            { kind: "output", text: "Olayinka David Vaughan — software engineer." },
            { kind: "output", text: "Quant systems, SWE, and analyst projects on a 3D rack-by-rack tour." },
            { kind: "output", text: "github @Builder106 · linkedin /in/yinka-vaughan/" },
          ];
        case "open":
        case "goto": {
          if (!arg) return [{ kind: "error", text: "usage: open <project-id> | contact | entrance | end" }];
          if (arg === "contact" || arg === "ping") {
            onNavigate({ kind: "contact" });
            return [{ kind: "ok", text: "→ opening contact panel" }];
          }
          if (arg === "terminal" || arg === "console") {
            return [{ kind: "system", text: "already in the control console." }];
          }
          if (arg === "entrance" || arg === "home" || arg === "start") {
            aisleScroll.set(0);
            flashWidget("telemetry");
            return [{ kind: "ok", text: "→ scrolling to corridor entrance" }];
          }
          if (arg === "end" || arg === "back") {
            aisleScroll.set(1);
            flashWidget("telemetry");
            return [{ kind: "ok", text: "→ scrolling to far end of aisle" }];
          }
          const match = projects.find((p) => p.id === arg);
          if (match) {
            onNavigate({ kind: "project", projectId: match.id });
            return [{ kind: "ok", text: `→ opening ${match.name}` }];
          }
          return [{ kind: "error", text: `unknown target '${arg}'. try: ${AISLE_ORDER.join(", ")}` }];
        }
        case "home":
          aisleScroll.set(0);
          flashWidget("telemetry");
          return [{ kind: "ok", text: "→ corridor entrance" }];
        case "end":
          aisleScroll.set(1);
          flashWidget("telemetry");
          return [{ kind: "ok", text: "→ far end of aisle" }];
        case "scroll": {
          const n = Number.parseFloat(arg ?? "");
          if (Number.isNaN(n)) return [{ kind: "error", text: "usage: scroll <0..1>" }];
          const clamped = Math.max(0, Math.min(1, n));
          aisleScroll.set(clamped);
          flashWidget("telemetry");
          return [{ kind: "ok", text: `→ scrolled to ${(clamped * 100).toFixed(0)}%` }];
        }
        case "mute":
          if (!audioEnabled) return [{ kind: "system", text: "audio is already muted." }];
          onToggleAudio();
          flashWidget("audio");
          return [{ kind: "ok", text: "→ audio muted" }];
        case "unmute":
          if (audioEnabled) return [{ kind: "system", text: "audio is already on." }];
          onToggleAudio();
          flashWidget("audio");
          return [{ kind: "ok", text: "→ audio unmuted" }];

        // ─── Hidden commands (Easter eggs) ─────────────────────────
        // Intentionally not listed in `help`. The welcome banner hints
        // that they exist with "try old-school unix". Triggering one
        // marks it as discovered for the `secrets` meta-command, which
        // persists progress across sessions via localStorage.

        case "whoami":
          markSecret("whoami");
          return [{ kind: "output", text: "ov · software engineer · level 1 · github.com/Builder106" }];

        case "ls":
        case "dir":
          markSecret("ls");
          return [
            { kind: "output", text: "projects/" },
            { kind: "output", text: "  " + AISLE_ORDER.slice(0, 3).join("   ") + "    [quant]" },
            { kind: "output", text: "  " + AISLE_ORDER.slice(3, 6).join("   ") + "  [swe]" },
            { kind: "output", text: "  " + AISLE_ORDER.slice(6).join("   ") + "  [analyst]" },
            { kind: "output", text: "" },
            { kind: "output", text: "use 'open <id>' to view." },
          ];

        case "pwd":
          markSecret("pwd");
          return [{ kind: "output", text: "/portfolio/control_console" }];

        case "date":
          markSecret("date");
          return [{ kind: "output", text: new Date().toString() }];

        case "uptime": {
          markSecret("uptime");
          const buildAt = new Date(BUILD_TIMESTAMP).getTime();
          const elapsedMs = Math.max(0, Date.now() - buildAt);
          const d = Math.floor(elapsedMs / 86_400_000);
          const h = Math.floor(elapsedMs / 3_600_000) % 24;
          const m = Math.floor(elapsedMs / 60_000) % 60;
          return [{
            kind: "output",
            text: `up ${d}d ${h}h ${m}m, 1 user, load avg: 0.42, 0.45, 0.39`,
          }];
        }

        case "history":
          markSecret("history");
          if (inputHistory.current.length === 0) {
            return [{ kind: "system", text: "no history yet." }];
          }
          return inputHistory.current
            .slice()
            .reverse()
            .map((cmd, i) => ({
              kind: "output" as const,
              text: `  ${(i + 1).toString().padStart(3)}  ${cmd}`,
            }));

        case "uname": {
          markSecret("uname");
          if (arg === "-a") {
            return [{
              kind: "output",
              text: `Portfolio 1.0.0 ${SHORT_SHA} #1 SMP WebGL2 r3f+vite ${new Date().getFullYear()} x86_64`,
            }];
          }
          return [{ kind: "output", text: "Portfolio" }];
        }

        case "sudo": {
          markSecret("sudo");
          if (args.join(" ").toLowerCase() === "make me a sandwich") {
            playSandwichCeremony();
            return [];
          }
          return [{
            kind: "error",
            text: "sudo: olayinka is not in the sudoers file. this incident will be reported.",
          }];
        }

        case "rm": {
          markSecret("rm");
          if (trimmed.toLowerCase().includes("-rf") || trimmed.includes("/")) {
            return [{ kind: "error", text: "rm: refusing to operate recursively. (this isn't your machine, friend.)" }];
          }
          return [{ kind: "error", text: `rm: cannot remove '${args.join(" ") || "."}': read-only portfolio.` }];
        }

        case "vim":
        case "vi":
        case "emacs":
        case "nano":
        case "ed":
          markSecret("editor");
          return [
            { kind: "error", text: `${c}: there's no escape from here.` },
            { kind: "system", text: "(press :wq — wait, that's just a vim joke.)" },
          ];

        case "coffee":
          markSecret("coffee");
          return [{ kind: "error", text: "418 i'm a teapot. (rfc 2324, march 1998.)" }];

        case "tea":
          markSecret("tea");
          return [{ kind: "ok", text: "brewing... actually no, this is a portfolio." }];

        case "make": {
          markSecret("make");
          if (trimmed.toLowerCase() === "make me a sandwich") {
            // xkcd 149 — the unprivileged half of the gag.
            return [{ kind: "system", text: "What? Make it yourself." }];
          }
          return [{ kind: "error", text: `make: *** No rule to make target '${args[0] ?? ""}'. Stop.` }];
        }

        case "hello":
        case "hi":
        case "hey":
        case "yo":
          markSecret("greet");
          return [{ kind: "output", text: "hi, traveler. type 'help' to explore. or keep poking around." }];

        case "exit":
        case "quit":
        case "q":
        case "bye":
          markSecret("exit");
          onClose();
          return [{ kind: "ok", text: "→ goodbye" }];

        case "42":
        case "fortytwo":
          markSecret("42");
          return [
            { kind: "ok", text: "the answer to life, the universe, and everything." },
            { kind: "system", text: "now what was the question?" },
          ];

        case "matrix":
          markSecret("matrix");
          return [
            { kind: "ok", text: matrixLine() },
            { kind: "ok", text: matrixLine() },
            { kind: "ok", text: matrixLine() },
            { kind: "ok", text: matrixLine() },
            { kind: "ok", text: matrixLine() },
            { kind: "ok", text: matrixLine() },
            { kind: "system", text: "wake up, neo." },
          ];

        case "wave":
          markSecret("wave");
          // ServerRoom listens for "ov-force-wave" on window and
          // triggers the idle-attractor spotlight wave without
          // waiting for the 15 s idle gate. Lets you confirm the
          // wave actually fires + visually lands without sitting
          // through the timer.
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("ov-force-wave"));
          }
          return [
            { kind: "ok", text: "→ idle wave triggered" },
            { kind: "system", text: "close this panel to see the rack spotlight." },
          ];

        case "konami":
          markSecret("konami");
          return [
            { kind: "banner", text: "  ↑ ↑ ↓ ↓ ← → ← → B A  " },
            { kind: "ok", text: "konami code recognized. +30 lives." },
            { kind: "system", text: "(it's cosmetic.)" },
          ];

        case "xyzzy":
          markSecret("xyzzy");
          return [{ kind: "system", text: "nothing happens." }];

        case "iddqd":
          markSecret("iddqd");
          return [
            { kind: "ok", text: "degreelessness mode on." },
            { kind: "system", text: "god mode is purely decorative here." },
          ];

        case "ascii":
        case "logo":
          markSecret("ascii");
          return ASCII_BANNER.map((line) => ({ kind: "banner" as const, text: line }));

        case "cowsay": {
          markSecret("cowsay");
          const text = args.join(" ") || "moo";
          const len = text.length;
          const top = " " + "_".repeat(len + 2);
          const bot = " " + "-".repeat(len + 2);
          return [
            { kind: "banner", text: top },
            { kind: "banner", text: `< ${text} >` },
            { kind: "banner", text: bot },
            { kind: "banner", text: "        \\   ^__^" },
            { kind: "banner", text: "         \\  (oo)\\_______" },
            { kind: "banner", text: "            (__)\\       )\\/\\" },
            { kind: "banner", text: "                ||----w |" },
            { kind: "banner", text: "                ||     ||" },
          ];
        }

        case "fortune": {
          markSecret("fortune");
          const pick = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
          return [{ kind: "output", text: pick }];
        }

        case "stats":
          markSecret("stats");
          return [
            { kind: "output", text: `projects deployed: ${projects.length}` },
            { kind: "output", text: "cluster split:     3 quant · 3 swe · 3 analyst" },
            { kind: "output", text: `build:             ${SHORT_SHA} · ${relativeTime(BUILD_TIMESTAMP)}` },
            { kind: "output", text: "frame budget:      16.6 ms (60 fps target)" },
            { kind: "output", text: "node_modules/:     yes" },
            { kind: "output", text: "coffee consumed:   NaN ml" },
          ];

        case "credits":
          markSecret("credits");
          return [
            { kind: "output", text: "built with:" },
            { kind: "output", text: "  react-three-fiber + drei  (3D scene)" },
            { kind: "output", text: "  three.js                  (WebGL)" },
            { kind: "output", text: "  vite + react              (build / ui)" },
            { kind: "output", text: "  blender                   (rack model)" },
            { kind: "output", text: "" },
            { kind: "output", text: "ambient music:" },
            { kind: "output", text: "  Vermillion Gaze — Sun Waves (full release, 4 tracks)" },
            { kind: "output", text: "  CC-BY 4.0 · archive.org/details/SunWaves" },
            { kind: "output", text: "" },
            { kind: "output", text: "source: github.com/Builder106/builder106.github.io" },
          ];

        case "secrets": {
          // Meta-command — never marks itself as found. Reports how
          // many hidden commands the user has triggered overall.
          const total = SECRET_KEYS.length;
          const found = discoveredSecrets.current.size;
          const pct = Math.round((found / total) * 100);
          const out: LogEntry[] = [
            { kind: "output", text: `secrets discovered: ${found}/${total} (${pct}%)` },
          ];
          if (found === total) {
            out.push({ kind: "ok", text: "you've found them all. legend." });
          } else if (found >= Math.ceil(total / 2)) {
            out.push({ kind: "system", text: "halfway there. keep poking." });
          } else if (found > 0) {
            out.push({ kind: "system", text: "keep exploring. there are more." });
          } else {
            out.push({ kind: "system", text: "none yet. try old-school unix commands?" });
          }
          return out;
        }

        // ─── Fallback ──────────────────────────────────────────────
        default:
          return [{ kind: "error", text: `unknown command '${c}'. type 'help'.` }];
      }
    },
    [audioEnabled, onClose, onNavigate, onToggleAudio, markSecret, flashWidget, playSandwichCeremony],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = input;
    setInput("");
    if (!value.trim()) return;
    inputHistory.current = [value, ...inputHistory.current].slice(0, 50);
    historyCursor.current = -1;
    const outputs = runCommand(value);
    if (outputs.length === 1 && outputs[0].text === "__clear__") {
      setLog(INITIAL_LOG);
      return;
    }
    setLog((prev) => [...prev, { kind: "input", text: value }, ...outputs]);
  };

  // Tab-cycle state. When the user hits Tab and the input has multiple
  // matching completions, we lock in the candidate list + which one
  // we're showing; further Tabs cycle through. *Any* non-Tab keypress
  // invalidates the cycle so a fresh prefix recomputes from scratch.
  const tabCycle = useRef<{ candidates: string[]; index: number } | null>(null);

  // Build the live completion set: visible commands always, plus the
  // alias-set for any secret command the user has discovered before.
  const completionCommands = useCallback((): string[] => {
    const discovered: string[] = [];
    for (const key of discoveredSecrets.current) {
      const aliases = SECRET_TO_ALIASES[key];
      if (aliases) discovered.push(...aliases);
    }
    return [...new Set([...VISIBLE_COMMANDS, ...discovered])].sort();
  }, []);

  const handleTab = useCallback(() => {
    const value = input;
    const parts = value.split(/\s+/);
    const lastPart = (parts[parts.length - 1] ?? "").toLowerCase();
    const prefix = parts.slice(0, -1).join(" ");
    const firstWord = parts[0]?.toLowerCase() ?? "";

    // Choose the completion namespace based on cursor position.
    let pool: string[];
    if (parts.length === 1) {
      // First token — match against commands.
      pool = completionCommands();
    } else if (firstWord === "open" || firstWord === "goto") {
      // Second token of nav commands — project ids + special targets.
      pool = [...AISLE_ORDER, ...GOTO_TARGETS].sort();
    } else {
      return;
    }

    const candidates = pool.filter((c) => c.startsWith(lastPart));
    if (candidates.length === 0) {
      tabCycle.current = null;
      return;
    }

    // If we already have a cycle going AND the current input is the
    // last candidate we typed in, advance to the next one.
    if (
      tabCycle.current &&
      tabCycle.current.candidates.length === candidates.length &&
      tabCycle.current.candidates.every((c, i) => c === candidates[i])
    ) {
      const next = (tabCycle.current.index + 1) % candidates.length;
      tabCycle.current.index = next;
      const completion = candidates[next];
      setInput(prefix ? `${prefix} ${completion}` : completion);
      return;
    }

    // Fresh completion. Show first candidate; if there's only one and
    // it matches exactly already, no-op.
    tabCycle.current = { candidates, index: 0 };
    const completion = candidates[0];
    setInput(prefix ? `${prefix} ${completion}` : completion);
  }, [completionCommands, input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      handleTab();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      tabCycle.current = null;
      const next = Math.min(historyCursor.current + 1, inputHistory.current.length - 1);
      historyCursor.current = next;
      if (next >= 0) setInput(inputHistory.current[next] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      tabCycle.current = null;
      const next = Math.max(historyCursor.current - 1, -1);
      historyCursor.current = next;
      setInput(next === -1 ? "" : inputHistory.current[next] ?? "");
      return;
    }
    // Any other key invalidates the tab cycle so the next Tab
    // recomputes against the edited prefix.
    tabCycle.current = null;
  };

  // Derive repo activity rows: project → repoStats joined on the
  // owner/name slug, sorted by most-recent push. Cap at six rows so
  // the widget doesn't dominate the dashboard on a narrow viewport.
  const repoRows = useMemo(() => {
    return projects
      .map((p) => {
        const repoUrl = p.links.repo;
        if (!repoUrl) return null;
        const slug = repoUrl.replace(/^https?:\/\/github\.com\//, "");
        const stats = repoStats[slug];
        if (!stats) return null;
        return { project: p, slug, stats };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.stats.pushed_at.localeCompare(a.stats.pushed_at))
      .slice(0, 6);
  }, []);

  // Cluster headcounts for the load widget. Stable across renders so
  // the bar fills don't reflow on every scroll tick.
  const clusterCounts = useMemo(() => {
    const counts = { quant: 0, swe: 0, analyst: 0 } as Record<string, number>;
    for (const p of projects) counts[p.cluster] = (counts[p.cluster] ?? 0) + 1;
    return counts;
  }, []);
  const totalProjects = projects.length;

  // Prefix glyph per entry kind so a glance at the column tells you
  // what each line is without reading the text. Kept aligned (two
  // chars wide) so multi-line outputs stay visually columnar.
  const prefixFor = (kind: LogEntry["kind"]): string => {
    switch (kind) {
      case "input": return "›";
      case "ok": return "✓";
      case "error": return "✗";
      case "system": return "·";
      case "banner": return " ";
      default: return " ";
    }
  };

  return (
    <PanelShell
      open={open}
      title="// control_console"
      onClose={onClose}
      variantClass="panel--console"
    >
      <section className="panel__section">
        <div className="console-pills">
          <div className="console-pill console-pill--build">
            <div className="console-pill__header">
              <span className="console-pill__title">build</span>
              <span className="console-pill__dot console-pill__dot--ok" aria-hidden />
            </div>
            <div className="console-pill__value">{SHORT_SHA}</div>
            <div className="console-pill__sub" title={BUILD_MESSAGE}>
              {BUILD_MESSAGE.length > 50
                ? `${BUILD_MESSAGE.slice(0, 48)}…`
                : BUILD_MESSAGE}
            </div>
            <div className="console-pill__meta">{relativeTime(BUILD_TIMESTAMP)}</div>
          </div>

          {/* Telemetry pill. Two variants:
              · Portrait (virtual aisle-scroll): scroll % + dominant
                rack as a click-to-jump button. The widget was originally
                a big horizontal aisle-map taking ~120 px of vertical
                space; this denser pill replaced it because "see all 9
                at once" didn't justify the room cost.
              · Landscape (orbit camera): no scroll, so the % was always
                0 and the rack button always pointed at slot 0. The
                pill swaps to a SESSION uptime read here — same shape,
                different signal. */}
          <div
            className={`console-pill console-pill--telemetry ${
              flashedWidget === "telemetry" ? "console-pill--flash" : ""
            }`}
          >
            {variant === "portrait" ? (
              <>
                <div className="console-pill__header">
                  <span className="console-pill__title">telemetry</span>
                  <span className="console-pill__dot console-pill__dot--live" aria-hidden />
                </div>
                <div className="console-pill__value">
                  {Math.round(progress * 100)}
                  <span className="console-pill__unit">%</span>
                </div>
                <div
                  className="console-pill__bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                >
                  <div
                    className="console-pill__bar-fill"
                    style={{ width: `${(progress * 100).toFixed(1)}%` }}
                  />
                </div>
                {activeRack ? (
                  <button
                    type="button"
                    className={`console-pill__sub-link console-pill__sub-link--${activeRack.cluster}`}
                    onClick={() => onNavigate({ kind: "project", projectId: activeRack.id })}
                  >
                    {activeRack.name}
                    <span className="console-pill__sub-cluster"> · {activeRack.cluster}</span>
                  </button>
                ) : (
                  <div className="console-pill__sub">between racks</div>
                )}
              </>
            ) : (
              <>
                <div className="console-pill__header">
                  <span className="console-pill__title">session</span>
                  <span className="console-pill__dot console-pill__dot--live" aria-hidden />
                </div>
                <div className="console-pill__value">
                  {formatUptime(uptimeMs)}
                </div>
                <div className="console-pill__sub">uptime · since boot</div>
              </>
            )}
          </div>

          <div
            className={`console-pill console-pill--audio ${
              flashedWidget === "audio" ? "console-pill--flash" : ""
            }`}
          >
            <div className="console-pill__header">
              <span className="console-pill__title">audio</span>
              <span
                className={`console-pill__dot ${
                  audioEnabled ? "console-pill__dot--ok" : "console-pill__dot--muted"
                }`}
                aria-hidden
              />
            </div>
            <div className="console-pill__value">
              {audioEnabled ? "online" : "muted"}
              <button
                type="button"
                className="console-pill__action"
                onClick={onToggleAudio}
              >
                {audioEnabled ? "mute" : "unmute"}
              </button>
            </div>
            {/* Track cycler. ‹ and › step through TRACKS; the middle
                line shows artist · title for the currently playing cut.
                All four are from the same Sun Waves release (CC-BY 4.0)
                so attribution is identical across the set. */}
            <div className="console-pill__track">
              <button
                type="button"
                className="console-pill__track-step"
                onClick={() => onSelectTrack(prevTrack.id)}
                aria-label={`previous track: ${prevTrack.title}`}
              >
                ‹
              </button>
              <span className="console-pill__track-info">
                <span className="console-pill__track-artist">
                  {currentTrack.artist.toLowerCase()}
                </span>
                <span className="console-pill__track-title">
                  {currentTrack.title.toLowerCase()}
                </span>
              </span>
              <button
                type="button"
                className="console-pill__track-step"
                onClick={() => onSelectTrack(nextTrack.id)}
                aria-label={`next track: ${nextTrack.title}`}
              >
                ›
              </button>
            </div>
          </div>

          <div className="console-pill console-pill--cluster">
            <div className="console-pill__header">
              <span className="console-pill__title">cluster_load</span>
              <span className="console-pill__dot console-pill__dot--ok" aria-hidden />
            </div>
            <div className="cluster-bars">
              {(["quant", "swe", "analyst"] as const).map((c) => {
                const count = clusterCounts[c] ?? 0;
                const pct = totalProjects > 0 ? (count / totalProjects) * 100 : 0;
                return (
                  <div key={c} className={`cluster-bar cluster-bar--${c}`}>
                    <span className="cluster-bar__label">{c}</span>
                    <span className="cluster-bar__track">
                      <span
                        className="cluster-bar__fill"
                        style={{ width: `${pct.toFixed(1)}%` }}
                      />
                    </span>
                    <span className="cluster-bar__count">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="panel__section">
        <div className="panel__section-label">
          repo_activity
          <span className="panel__section-meta">{repoRows.length} repos · last push</span>
        </div>
        <ul className="repo-list">
          {repoRows.map(({ project, stats }) => (
            <li key={project.id}>
              <button
                type="button"
                className={`repo-row repo-row--${project.cluster}`}
                onClick={() => onNavigate({ kind: "project", projectId: project.id })}
              >
                <span className="repo-row__stripe" aria-hidden />
                <span className="repo-row__cluster">{project.cluster}</span>
                <span className="repo-row__name">{project.name}</span>
                <span className="repo-row__lang">{stats.lang ?? "—"}</span>
                <span className="repo-row__time">{relativeTime(stats.pushed_at)}</span>
                <span className="repo-row__arrow" aria-hidden>›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel__section console-section">
        <div className="panel__section-label">prompt</div>
        <div className="console-log" ref={logRef} aria-live="polite">
          {log.map((entry, i) => (
            <div
              key={i}
              className={`console-log__entry console-log__entry--${entry.kind}`}
            >
              {entry.kind !== "banner" && (
                <span className="console-log__prefix" aria-hidden>{prefixFor(entry.kind)}</span>
              )}
              <span className="console-log__text">{entry.text}</span>
            </div>
          ))}
        </div>
        <form className="console-input-row" onSubmit={handleSubmit}>
          <span className="console-prompt-prefix">
            <span className="console-prompt-prefix__user">ov</span>
            <span className="console-prompt-prefix__at">@</span>
            <span className="console-prompt-prefix__host">portfolio</span>
            <span className="console-prompt-prefix__sep">:</span>
            <span className="console-prompt-prefix__cwd">~</span>
            <span className="console-prompt-prefix__sigil">$</span>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="console-input"
            placeholder="type a command (try 'help')"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            aria-label="console command"
          />
          <span className="console-caret" aria-hidden />
        </form>
      </section>
    </PanelShell>
  );
}
