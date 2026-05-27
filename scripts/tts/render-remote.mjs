#!/usr/bin/env node
// Remote Chatterbox TTS render — offloads the audio generation to
// Replicate's hosted resemble-ai/chatterbox endpoint instead of the
// local CPU/MPS path (which hangs on MPS and takes 1–2 h on CPU for a
// ~40 s clip). One call costs ~$0.03–0.06 and lands in <60 s.
//
// Usage:
//   REPLICATE_API_TOKEN=r8_… node scripts/tts/render-remote.mjs \
//     [--text e2e/demo/output/narration.txt] \
//     [--ref  ../../content-pipeline/voice-samples/reference.wav] \
//     [--out  e2e/demo/output/narration.wav] \
//     [--exaggeration 0.4] [--cfg 0.6] [--schema]
//
// --schema prints the model's input JSON schema (so you can verify the
// parameter names if Replicate's Chatterbox version drifts) and exits
// without firing a billed prediction.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename, extname } from "node:path";
import Replicate from "replicate";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

// Auto-load REPLICATE_API_TOKEN (and anything else) from the repo's
// gitignored env files. `.env.local` wins over `.env` to match Vite's
// own precedence, so a developer can override a shared default. Both
// loads are best-effort — a missing or malformed file is just skipped.
for (const name of [".env.local", ".env"]) {
  const path = resolve(repoRoot, name);
  if (!existsSync(path)) continue;
  try {
    process.loadEnvFile(path);
  } catch {
    /* malformed line / unreadable — leave env as-is */
  }
}

// The reference voice lives in a sibling repo (content-pipeline) so
// the TTS toolchain is shared across projects. content-pipeline sits
// next to Projects/, so the relative path from this repo's root is
// two levels up + content-pipeline.
const DEFAULT_REF = resolve(
  repoRoot,
  "../../content-pipeline/voice-samples/reference.wav",
);
const DEFAULT_TEXT = resolve(repoRoot, "e2e/demo/output/narration.txt");
const DEFAULT_OUT = resolve(repoRoot, "e2e/demo/output/narration.wav");

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(
    "Usage: node scripts/tts/render-remote.mjs [--text PATH] [--ref PATH]",
    "[--out PATH] [--exaggeration 0-1] [--cfg 0-1] [--schema]",
  );
  process.exit(0);
}

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error(
    "[render-remote] REPLICATE_API_TOKEN not set. Get one at",
    "https://replicate.com/account/api-tokens and `export` it before running.",
  );
  process.exit(2);
}

const replicate = new Replicate({ auth: token });
const MODEL = "resemble-ai/chatterbox";

if (args.schema) {
  // Cheap pre-flight: prints the live input schema so the user can
  // confirm whether the parameter names below (`prompt`, `audio_prompt`,
  // `exaggeration`, `cfg_weight`) still match the deployed model.
  const model = await replicate.models.get("resemble-ai", "chatterbox");
  const schema = model.latest_version?.openapi_schema?.components?.schemas?.Input;
  if (!schema) {
    console.error("[render-remote] could not extract input schema");
    console.log(JSON.stringify(model, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(schema, null, 2));
  process.exit(0);
}

const textPath = resolve(repoRoot, args.text ?? DEFAULT_TEXT);
const refPath = resolve(repoRoot, args.ref ?? DEFAULT_REF);
const outPath = resolve(repoRoot, args.out ?? DEFAULT_OUT);

if (!existsSync(textPath)) {
  console.error(`[render-remote] text file not found: ${textPath}`);
  process.exit(2);
}
if (!existsSync(refPath)) {
  console.error(`[render-remote] reference audio not found: ${refPath}`);
  process.exit(2);
}

const text = (await readFile(textPath, "utf-8")).trim();
const refBuffer = await readFile(refPath);

if (!text) {
  console.error(`[render-remote] text file is empty: ${textPath}`);
  process.exit(2);
}

console.error(
  `[render-remote] model=${MODEL}, text=${text.length} chars, ref=${basename(refPath)} (${(refBuffer.length / 1024).toFixed(0)} KB)`,
);

// Replicate's Node SDK accepts a Blob for file inputs; the SDK uploads
// it to its CDN and the model receives a URL. Buffer → Blob keeps the
// upload in one round-trip instead of staging through a separate
// files.create() call.
const mime = extname(refPath).toLowerCase() === ".mp3" ? "audio/mpeg" : "audio/wav";
const refBlob = new Blob([refBuffer], { type: mime });

const t0 = Date.now();
const output = await replicate.run(MODEL, {
  input: {
    // Names mirror the upstream chatterbox-tts Python API
    // (`model.generate(text, audio_prompt_path=…, exaggeration=…,
    // cfg_weight=…)`). If Replicate ever renames them, `--schema` will
    // surface the live names.
    prompt: text,
    audio_prompt: refBlob,
    exaggeration: args.exaggeration ?? 0.4,
    cfg_weight: args.cfg ?? 0.6,
  },
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.error(`[render-remote] prediction completed in ${elapsed} s`);

// Output shapes the SDK can return for an audio model:
//   · FileOutput (a ReadableStream subclass with .blob() / .url())
//   · A URL string
//   · An array containing one of the above
// Normalise to a single Blob/Buffer write.
const item = Array.isArray(output) ? output[0] : output;

let buffer;
if (item && typeof item === "object" && typeof item.blob === "function") {
  buffer = Buffer.from(await (await item.blob()).arrayBuffer());
} else if (typeof item === "string") {
  const res = await fetch(item);
  if (!res.ok) {
    console.error(`[render-remote] failed to fetch result: ${res.status}`);
    process.exit(1);
  }
  buffer = Buffer.from(await res.arrayBuffer());
} else {
  console.error(`[render-remote] unexpected output shape: ${typeof item}`);
  console.error(JSON.stringify(item, null, 2));
  process.exit(1);
}

await writeFile(outPath, buffer);
console.error(
  `[render-remote] wrote ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`,
);

// --- args ---------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--text") out.text = argv[++i];
    else if (a === "--ref") out.ref = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--exaggeration") out.exaggeration = Number(argv[++i]);
    else if (a === "--cfg") out.cfg = Number(argv[++i]);
    else if (a === "--schema") out.schema = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`[render-remote] unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return out;
}
