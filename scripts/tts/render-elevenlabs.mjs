#!/usr/bin/env node
// ElevenLabs voice-clone TTS render. Their Instant Voice Cloning (IVC)
// is the strongest off-the-shelf clone available: upload 1–5 min of
// reference audio, get a permanent voice_id you can call from any
// future render. Use this when Chatterbox's zero-shot clone misses
// the accent / timbre (a known weakness on its training distribution).
//
// One-time setup:
//   $ node scripts/tts/render-elevenlabs.mjs --create-voice
//     [--ref PATH] [--name "Yinka Vaughan"]
//   # → prints ELEVENLABS_VOICE_ID=… ; paste into .env.
//
// Subsequent renders:
//   $ node scripts/tts/render-elevenlabs.mjs
//     [--text PATH] [--out PATH] [--voice-id ID]
//     [--model eleven_multilingual_v2] [--stability 0.7]
//     [--similarity 0.85] [--style 0] [--speed 1.0]
//
// Defaults to MP3 output since Starter-tier accounts can't request
// PCM/WAV. demo:mux handles both transparently (ffmpeg).

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

// Auto-load .env / .env.local — same precedence as render-remote.mjs.
for (const name of [".env.local", ".env"]) {
  const path = resolve(repoRoot, name);
  if (!existsSync(path)) continue;
  try {
    process.loadEnvFile(path);
  } catch {
    /* malformed line / unreadable — leave env as-is */
  }
}

const DEFAULT_REF = resolve(
  repoRoot,
  "../../content-pipeline/voice-samples/reference.wav",
);
const DEFAULT_TEXT = resolve(repoRoot, "e2e/demo/output/narration.txt");
const DEFAULT_OUT = resolve(repoRoot, "e2e/demo/output/narration-eleven.mp3");
const DEFAULT_NAME = "Yinka Vaughan";
const DEFAULT_MODEL = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"; // Starter-tier ceiling.

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error(
    "[elevenlabs] ELEVENLABS_API_KEY not set. Generate one at",
    "https://elevenlabs.io/app/settings/api-keys and add to .env.",
  );
  process.exit(2);
}

const client = new ElevenLabsClient({ apiKey });

// ── --create-voice ────────────────────────────────────────────────────────
// One-time setup: upload reference, get back a voice_id.
if (args.createVoice) {
  const refPath = resolve(repoRoot, args.ref ?? DEFAULT_REF);
  if (!existsSync(refPath)) {
    console.error(`[create-voice] reference not found: ${refPath}`);
    process.exit(2);
  }
  const refStat = await import("node:fs").then((m) => m.statSync(refPath));
  console.error(
    `[create-voice] uploading ${basename(refPath)} (${(refStat.size / 1024).toFixed(0)} KB)…`,
  );
  const t0 = Date.now();
  const response = await client.voices.ivc.create({
    name: args.name ?? DEFAULT_NAME,
    files: [createReadStream(refPath)],
    description:
      "Voice clone for portfolio demo narration. Reference recorded as " +
      "documentation-style narration prose for best timbre match.",
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const voiceId = response.voiceId;
  console.error(
    `[create-voice] created in ${elapsed} s. voice_id = ${voiceId}`,
  );
  console.log();
  console.log("Add this to .env:");
  console.log(`  ELEVENLABS_VOICE_ID=${voiceId}`);
  process.exit(0);
}

// ── render ────────────────────────────────────────────────────────────────
const voiceId = args.voiceId ?? process.env.ELEVENLABS_VOICE_ID;
if (!voiceId) {
  console.error(
    "[elevenlabs] no voice ID. Run `npm run voice:eleven:create` first,",
    "or pass --voice-id <id>, or set ELEVENLABS_VOICE_ID in .env.",
  );
  process.exit(2);
}

const textPath = resolve(repoRoot, args.text ?? DEFAULT_TEXT);
const outPath = resolve(repoRoot, args.out ?? DEFAULT_OUT);

if (!existsSync(textPath)) {
  console.error(`[elevenlabs] text file not found: ${textPath}`);
  process.exit(2);
}

const text = (await readFile(textPath, "utf-8")).trim();
if (!text) {
  console.error(`[elevenlabs] text file is empty: ${textPath}`);
  process.exit(2);
}

const voiceSettings = {
  // Defaults tuned for documentation-narration tone: anchored timbre
  // (high stability), close to the reference (high similarityBoost),
  // no style exaggeration, normal speed. The CLI flags override.
  stability: args.stability ?? 0.7,
  similarityBoost: args.similarity ?? 0.85,
  style: args.style ?? 0.0,
  useSpeakerBoost: true,
  speed: args.speed ?? 1.0,
};

console.error(
  `[elevenlabs] model=${args.model ?? DEFAULT_MODEL}, voice=${voiceId},`,
  `text=${text.length} chars`,
);
console.error(
  `[elevenlabs] settings:`,
  JSON.stringify(voiceSettings),
);

// Render paragraph-by-paragraph. An ElevenLabs voice clone drifts off the
// reference over a long single generation — it "starts like you, then goes
// robotic" after ~15-20 s. Splitting the script into short requests
// re-anchors the voice on each one; previousText / nextText feed the
// neighbouring lines as context (not synthesised, not billed) so prosody
// still flows across the joins instead of sounding stitched. Segments are
// then concatenated with a short pause between paragraphs. --no-chunk
// falls back to the old single-shot behaviour.
const segments = args.noChunk
  ? [text]
  : text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

const tmpDir = resolve(repoRoot, "e2e/demo/output/.eleven-chunks");
await mkdir(tmpDir, { recursive: true });

const t0 = Date.now();
const segFiles = [];
for (let i = 0; i < segments.length; i++) {
  const stream = await client.textToSpeech.convert(voiceId, {
    text: segments[i],
    modelId: args.model ?? DEFAULT_MODEL,
    voiceSettings,
    outputFormat: args.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
    previousText: segments[i - 1],
    nextText: segments[i + 1],
  });
  const buf = await streamToBuffer(stream);
  const segFile = resolve(tmpDir, `seg-${String(i).padStart(2, "0")}.mp3`);
  await writeFile(segFile, buf);
  segFiles.push(segFile);
  console.error(
    `[elevenlabs]   segment ${i + 1}/${segments.length}` +
      ` (${segments[i].length} chars, ${(buf.byteLength / 1024).toFixed(0)} KB)`,
  );
}

if (segFiles.length === 1) {
  await copyFile(segFiles[0], outPath);
} else {
  // 0.5 s pause between paragraphs, then concat. Re-encode (not -c copy)
  // so the generated silence and the ElevenLabs MP3s share one clean
  // stream — concat-copy glitches on mismatched frame headers.
  const silence = resolve(tmpDir, "silence.mp3");
  await runFfmpeg([
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.5", "-q:a", "9", "-y", silence,
  ]);
  const listPath = resolve(tmpDir, "concat.txt");
  const lines = [];
  segFiles.forEach((f, i) => {
    lines.push(`file '${f}'`);
    if (i < segFiles.length - 1) lines.push(`file '${silence}'`);
  });
  await writeFile(listPath, lines.join("\n") + "\n");
  await runFfmpeg([
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-c:a", "libmp3lame", "-b:a", "128k", "-y", outPath,
  ]);
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.error(
  `[elevenlabs] wrote ${outPath} — ${segFiles.length} segment(s) in ${elapsed} s`,
);

// ── helpers ─────────────────────────────────────────────────────────────────

async function streamToBuffer(stream) {
  const chunks = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function runFfmpeg(ffArgs) {
  return new Promise((res, rej) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...ffArgs], {
      stdio: "inherit",
    });
    p.on("error", rej);
    p.on("close", (code) =>
      code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)),
    );
  });
}

// ── args ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--text") out.text = argv[++i];
    else if (a === "--ref") out.ref = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--voice-id") out.voiceId = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--model") out.model = argv[++i];
    else if (a === "--stability") out.stability = Number(argv[++i]);
    else if (a === "--similarity") out.similarity = Number(argv[++i]);
    else if (a === "--style") out.style = Number(argv[++i]);
    else if (a === "--speed") out.speed = Number(argv[++i]);
    else if (a === "--output-format") out.outputFormat = argv[++i];
    else if (a === "--create-voice") out.createVoice = true;
    else if (a === "--no-chunk") out.noChunk = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`[elevenlabs] unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

function printHelp() {
  console.log(`
Usage:
  --create-voice           one-time IVC setup; prints voice_id
  --text PATH              narration text (default: narration.txt)
  --out PATH               output file (default: narration-eleven.mp3)
  --ref PATH               reference WAV for --create-voice
  --voice-id ID            override ELEVENLABS_VOICE_ID
  --name NAME              name for the new clone (default: "Yinka Vaughan")
  --model ID               ElevenLabs model id (default: eleven_multilingual_v2;
                           alternatives: eleven_turbo_v2_5, eleven_v3)
  --stability 0-1          voice stability (default: 0.7)
  --similarity 0-1         similarityBoost (default: 0.85)
  --style 0-1              style exaggeration (default: 0.0)
  --speed 0.5-2.0          playback speed (default: 1.0)
  --no-chunk               render the whole script in one request (legacy;
                           the clone drifts robotic on long single clips —
                           default renders per paragraph and concatenates)
  --output-format CODEC    e.g. mp3_44100_192 (Creator+), pcm_44100 (Pro+)
`);
}
