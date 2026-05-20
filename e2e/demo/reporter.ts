import { execSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

// Per-scenario state we accumulate during onTestEnd and process once at
// onEnd. We defer to onEnd because Playwright doesn't guarantee the video
// file is fully written by the time onTestEnd fires.
interface PendingVideo {
  sourcePath: string;
  slug: string;
  isWarmup: boolean;
  passed: boolean;
}

// Output directory for the converted mp4s. Relative to repo root.
const OUT_DIR = resolve(process.cwd(), "e2e/demo/output");

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default class DemoVideoReporter implements Reporter {
  private pending: PendingVideo[] = [];

  onBegin(_config: FullConfig, _suite: Suite): void {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const video = result.attachments.find((a) => a.name === "video");
    if (!video?.path) return;

    const feature = (test.parent.title || "feature").replace(/\.feature$/, "");
    const scenario = test.title || "scenario";
    const slug = `${slugify(feature)}-${slugify(scenario)}`;

    this.pending.push({
      sourcePath: video.path,
      slug,
      isWarmup: slug.startsWith("00-warmup-"),
      passed: result.status === "passed",
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.pending.length === 0) return;

    let kept = 0;
    let dropped = 0;
    let converted = 0;
    let failed = 0;

    for (const { sourcePath, slug, isWarmup, passed } of this.pending) {
      // Warmup videos: drop the webm + the per-test folder Playwright made.
      if (isWarmup) {
        safeUnlink(sourcePath);
        safeRmDir(dirname(sourcePath));
        dropped++;
        continue;
      }
      // Failed tests: keep the per-test folder for debugging. Convert the
      // webm to mp4 anyway (often it captured a useful prefix) but don't
      // clean up the source artifacts.
      if (!passed) {
        if (existsSync(sourcePath) && statSync(sourcePath).size > 0) {
          const mp4Path = join(OUT_DIR, `${slug}-FAILED.mp4`);
          tryConvert(sourcePath, mp4Path);
        }
        continue;
      }
      // 0-byte sentinel from the Playwright bug — skip without erroring.
      if (!existsSync(sourcePath) || statSync(sourcePath).size === 0) {
        safeUnlink(sourcePath);
        safeRmDir(dirname(sourcePath));
        dropped++;
        continue;
      }
      const mp4Path = join(OUT_DIR, `${slug}.mp4`);
      try {
        execSync(
          [
            "ffmpeg",
            "-y",
            "-i", quote(sourcePath),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            quote(mp4Path),
          ].join(" "),
          { stdio: "pipe" },
        );
        converted++;
        // Conversion succeeded — remove the webm source + per-test folder.
        safeUnlink(sourcePath);
        safeRmDir(dirname(sourcePath));
        kept++;
      } catch (err) {
        failed++;
        // eslint-disable-next-line no-console
        console.error(`[demo-reporter] ffmpeg failed for ${slug}:`, err);
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `\n[demo-reporter] kept ${kept} mp4 → ${OUT_DIR}` +
        (dropped ? `, dropped ${dropped} (warmup / 0-byte)` : "") +
        (failed ? `, ${failed} failed` : ""),
    );
    // Mark converted as used for stricter linters.
    void converted;
  }
}

function tryConvert(sourcePath: string, mp4Path: string): boolean {
  try {
    execSync(
      [
        "ffmpeg", "-y", "-i", quote(sourcePath),
        "-c:v", "libx264", "-preset", "veryfast",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        quote(mp4Path),
      ].join(" "),
      { stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

function safeUnlink(path: string): void {
  try { unlinkSync(path); } catch { /* already gone */ }
}

function safeRmDir(path: string): void {
  try { rmSync(path, { recursive: true, force: true }); } catch { /* already gone */ }
}

// Wrap a path in double quotes for the shell, escaping any embedded ones.
function quote(p: string): string {
  return `"${p.replace(/"/g, '\\"')}"`;
}

// Re-export rename in case any future hook wants to move files atomically.
export { renameSync };
