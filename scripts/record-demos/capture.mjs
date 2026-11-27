// Frame-exact capture for the demo recorders.
//
// Playwright's recordVideo samples the compositor in real time, so a slow
// headless renderer drops frames and the demos stutter. This builds the
// video one frame at a time instead: the recorder sets the scroll or
// control state for frame N, advances the page's clock by exactly 1/FPS,
// takes a screenshot, and moves on.
//
// The page clock is a shim installed before any page script runs
// (installClock). Once capture starts it takes over timers,
// requestAnimationFrame, Date, performance.now and Web/CSS animations, so
// the page's own motion plays at true speed however long a screenshot
// takes. Network and websocket events still arrive in real time.
// (Chrome's built-in virtual time does the same job, but headless
// screenshots stall for seconds per frame while it is paused.)

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const CLOCK_SHIM = () => {
  const real = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    raf: window.requestAnimationFrame.bind(window),
    caf: window.cancelAnimationFrame.bind(window),
    perfNow: performance.now.bind(performance),
    Date: window.Date,
  };
  let active = false;
  let now = 0;
  let epoch = 0;
  let nextId = 1e9;
  const timers = new Map();
  const frames = new Map();

  performance.now = () => (active ? now : real.perfNow());
  class VDate extends real.Date {
    constructor(...args) {
      if (args.length || !active) super(...args);
      else super(epoch + now);
    }
    static now() {
      return active ? epoch + now : real.Date.now();
    }
  }
  window.Date = VDate;

  const schedule = (fn, ms, args, every) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, args, every });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => (active ? schedule(fn, ms, args, 0) : real.setTimeout(fn, ms, ...args));
  window.setInterval = (fn, ms, ...args) =>
    active ? schedule(fn, ms, args, Math.max(1, Number(ms) || 0)) : real.setInterval(fn, ms, ...args);
  window.clearTimeout = (id) => (timers.delete(id) ? undefined : real.clearTimeout(id));
  window.clearInterval = (id) => (timers.delete(id) ? undefined : real.clearInterval(id));
  window.requestAnimationFrame = (fn) => {
    if (!active) return real.raf(fn);
    const id = nextId++;
    frames.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => (frames.delete(id) ? undefined : real.caf(id));

  const call = (fn, args) => {
    try {
      if (typeof fn === "function") fn(...args);
    } catch (err) {
      console.error(err);
    }
  };

  window.__demoClock = {
    start() {
      now = real.perfNow();
      epoch = real.Date.now() - now;
      active = true;
    },
    advance(step) {
      const end = now + step;
      for (let guard = 0; guard < 10_000; guard++) {
        let due = null;
        for (const [id, t] of timers) if (t.at <= end && (!due || t.at < due[1].at)) due = [id, t];
        if (!due) break;
        const [id, t] = due;
        now = Math.max(now, t.at);
        if (t.every) t.at += t.every;
        else timers.delete(id);
        call(t.fn, t.args);
      }
      now = end;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const fn of callbacks) call(fn, [now]);
      for (const anim of document.getAnimations()) {
        if (anim.playState === "finished") continue;
        if (!anim.__demoClock) {
          anim.pause();
          anim.__demoClock = true;
        }
        anim.currentTime = (Number(anim.currentTime) || 0) + step;
      }
    },
  };
};

// Browser launch options. Set CHROME_PATH to a desktop Chrome to render on
// the GPU (much faster screenshots on a Mac); otherwise Playwright's
// bundled headless Chromium is used.
export const launchOptions = process.env.CHROME_PATH
  ? {
      headless: true,
      executablePath: process.env.CHROME_PATH,
      args: ["--use-angle=metal", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"],
    }
  : { headless: true };

// Install the page clock. Call before the first navigation.
export async function installClock(context) {
  await context.addInitScript(CLOCK_SHIM);
}

export async function frameRecorder(page, { fps, dir }) {
  const cdp = await page.context().newCDPSession(page);
  const stepMs = 1000 / fps;
  let index = 0;

  const started = Date.now();
  await page.evaluate(() => window.__demoClock.start());

  async function frame() {
    await page.evaluate((step) => window.__demoClock.advance(step), stepMs);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
    writeFileSync(path.join(dir, `f${String(index).padStart(5, "0")}.jpg`), Buffer.from(data, "base64"));
    index += 1;
  }

  return {
    frame,
    get count() {
      return index;
    },
    // Real time per second of video: how much longer than life the
    // capture took. The page clock keeps page motion at 1×.
    get slowdown() {
      return index ? (Date.now() - started) / (index * stepMs) : 1;
    },
    // Hold the current state for `ms` of video.
    async hold(ms) {
      for (let i = Math.round(ms / stepMs); i > 0; i--) await frame();
    },
    // Run `apply(easedT)` before each frame for `ms` of video.
    async tween(ms, apply, ease = easeInOut) {
      const n = Math.max(1, Math.round(ms / stepMs));
      for (let i = 1; i <= n; i++) {
        await apply(ease(i / n));
        await frame();
      }
    },
  };
}

// Two-pass VP9 from the numbered JPEG frames.
export function encodeFrames(dir, fps, out, bitrate) {
  const input = ["-framerate", String(fps), "-i", path.join(dir, "f%05d.jpg")];
  const common = [
    "-c:v", "libvpx-vp9", "-b:v", bitrate,
    "-deadline", "good", "-cpu-used", "2", "-row-mt", "1",
    "-pix_fmt", "yuv420p", "-an", "-passlogfile", path.join(dir, "vp9pass"),
  ];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, ...common, "-pass", "1", "-f", "null", "/dev/null"], { stdio: "inherit" });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, ...common, "-pass", "2", out], { stdio: "inherit" });
}
