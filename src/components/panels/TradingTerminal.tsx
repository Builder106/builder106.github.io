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
import { PanelShell } from "./PanelShell";

interface TradingTerminalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: ActivePanel) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
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

type LogEntry = { kind: "input" | "output" | "system"; text: string };

const INITIAL_LOG: LogEntry[] = [
  { kind: "system", text: "control console online." },
  { kind: "system", text: "type 'help' for command list." },
];

const SHORT_SHA = __BUILD_SHA__;
const BUILD_MESSAGE = __BUILD_MESSAGE__;
const BUILD_TIMESTAMP = __BUILD_TIMESTAMP__;

export function TradingTerminal({
  open,
  onClose,
  onNavigate,
  audioEnabled,
  onToggleAudio,
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

  // Console state. The log scrolls inside a fixed-height container; the
  // input is uncontrolled-via-ref + cycles through past inputs on
  // ArrowUp/ArrowDown.
  const [log, setLog] = useState<LogEntry[]>(INITIAL_LOG);
  const [input, setInput] = useState("");
  const inputHistory = useRef<string[]>([]);
  const historyCursor = useRef<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-focus the prompt when the panel opens — the user almost
  // certainly wants to start typing.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Auto-scroll the log to the latest entry whenever it grows.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

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
            { kind: "output", text: "  open <id>      open a project panel by id" },
            { kind: "output", text: "  goto <target>  contact | entrance | end | <project-id>" },
            { kind: "output", text: "  home / end     scroll to entrance / far end of aisle" },
            { kind: "output", text: "  scroll <0..1>  jump to a scroll position" },
            { kind: "output", text: "  mute / unmute  toggle ambient audio" },
            { kind: "output", text: "  about          short bio" },
            { kind: "output", text: "  clear          wipe this log" },
            { kind: "output", text: "  help           show this list" },
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
          if (!arg) return [{ kind: "output", text: "usage: open <project-id> | contact | entrance | end" }];
          if (arg === "contact" || arg === "ping") {
            onNavigate({ kind: "contact" });
            return [{ kind: "output", text: "→ opening contact panel" }];
          }
          if (arg === "terminal" || arg === "console") {
            return [{ kind: "output", text: "already in the control console." }];
          }
          if (arg === "entrance" || arg === "home" || arg === "start") {
            aisleScroll.set(0);
            return [{ kind: "output", text: "→ scrolling to corridor entrance" }];
          }
          if (arg === "end" || arg === "back") {
            aisleScroll.set(1);
            return [{ kind: "output", text: "→ scrolling to far end of aisle" }];
          }
          const match = projects.find((p) => p.id === arg);
          if (match) {
            onNavigate({ kind: "project", projectId: match.id });
            return [{ kind: "output", text: `→ opening ${match.name}` }];
          }
          return [{ kind: "output", text: `unknown target '${arg}'. try: ${AISLE_ORDER.join(", ")}` }];
        }
        case "home":
          aisleScroll.set(0);
          return [{ kind: "output", text: "→ corridor entrance" }];
        case "end":
          aisleScroll.set(1);
          return [{ kind: "output", text: "→ far end of aisle" }];
        case "scroll": {
          const n = Number.parseFloat(arg ?? "");
          if (Number.isNaN(n)) return [{ kind: "output", text: "usage: scroll <0..1>" }];
          const clamped = Math.max(0, Math.min(1, n));
          aisleScroll.set(clamped);
          return [{ kind: "output", text: `→ scrolled to ${(clamped * 100).toFixed(0)}%` }];
        }
        case "mute":
          if (!audioEnabled) return [{ kind: "output", text: "audio is already muted." }];
          onToggleAudio();
          return [{ kind: "output", text: "→ audio muted" }];
        case "unmute":
          if (audioEnabled) return [{ kind: "output", text: "audio is already on." }];
          onToggleAudio();
          return [{ kind: "output", text: "→ audio unmuted" }];
        default:
          return [{ kind: "output", text: `unknown command '${c}'. type 'help'.` }];
      }
    },
    [audioEnabled, onNavigate, onToggleAudio],
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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyCursor.current + 1, inputHistory.current.length - 1);
      historyCursor.current = next;
      if (next >= 0) setInput(inputHistory.current[next] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(historyCursor.current - 1, -1);
      historyCursor.current = next;
      setInput(next === -1 ? "" : inputHistory.current[next] ?? "");
    }
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

  return (
    <PanelShell open={open} title="// control_console" onClose={onClose}>
      <section className="panel__section">
        <div className="panel__section-label">system.status</div>
        <div className="console-dashboard">
          <div className="console-widget">
            <div className="console-widget__title">build</div>
            <div className="console-widget__value">{SHORT_SHA}</div>
            <div className="console-widget__sub" title={BUILD_MESSAGE}>
              {BUILD_MESSAGE.length > 40
                ? `${BUILD_MESSAGE.slice(0, 38)}…`
                : BUILD_MESSAGE}
            </div>
            <div className="console-widget__sub">{relativeTime(BUILD_TIMESTAMP)}</div>
          </div>

          <div className="console-widget">
            <div className="console-widget__title">telemetry</div>
            <div className="console-widget__value">{(progress * 100).toFixed(0)}%</div>
            <div className="console-widget__sub">
              {activeRack
                ? `${activeRack.name} · ${activeRack.cluster}`
                : "between racks"}
            </div>
          </div>

          <div className="console-widget">
            <div className="console-widget__title">audio</div>
            <div className="console-widget__value">{audioEnabled ? "on" : "muted"}</div>
            <button
              type="button"
              className="console-widget__toggle"
              onClick={onToggleAudio}
            >
              {audioEnabled ? "mute" : "unmute"}
            </button>
          </div>

          <div className="console-widget console-widget--span">
            <div className="console-widget__title">repo activity</div>
            <ul className="console-widget__list">
              {repoRows.map(({ project, stats }) => (
                <li key={project.id} className="console-widget__row">
                  <span className="console-widget__row-name">{project.name}</span>
                  <span className="console-widget__row-meta">
                    {stats.lang ?? "—"} · {relativeTime(stats.pushed_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="panel__section console-section">
        <div className="panel__section-label">prompt</div>
        <div className="console-log" ref={logRef} aria-live="polite">
          {log.map((entry, i) => (
            <div
              key={i}
              className={`console-log__entry console-log__entry--${entry.kind}`}
            >
              {entry.text}
            </div>
          ))}
        </div>
        <form className="console-input-row" onSubmit={handleSubmit}>
          <span className="console-prompt-prefix">ov@portfolio:~$</span>
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
          />
        </form>
      </section>
    </PanelShell>
  );
}
