import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { projects } from "./src/data/projects.ts";
import {
  buildLlmsTxt,
  buildSemanticContentHTML,
  buildStructuredDataJSON,
} from "./src/utils/semanticHtml.ts";

interface RepoStatEntry {
  stars: number;
  lang: string | null;
  pushed_at: string;
}

// Fetch star counts, primary language, and last-push timestamp for each project's
// GitHub repo directly from typed project objects. Writes to `repoStats.generated.ts`.
// Gracefully skips overwriting if offline or unauthenticated so committed stats remain.
function syncRepoStats(): void {
  const slugs = Array.from(
    new Set(
      projects
        .map((p) => p.links.repo)
        .filter((url): url is string => Boolean(url && url.startsWith("https://github.com/")))
        .map((url) => url.replace("https://github.com/", "")),
    ),
  );

  const stats: Record<string, RepoStatEntry> = {};
  for (const slug of slugs) {
    try {
      const out = execSync(
        `gh api repos/${slug} --jq '{stars: .stargazers_count, lang: .language, pushed_at: .pushed_at}'`,
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      stats[slug] = JSON.parse(out);
    } catch {
      // Offline, rate limited, or unauthenticated; continue
    }
  }

  const outPath = path.resolve(import.meta.dirname, "src/data/repoStats.generated.ts");
  if (Object.keys(stats).length === 0) {
    return;
  }

  const header =
    "// Auto-generated at build time from projects.ts and GitHub API.\n" +
    "// Don't edit by hand.\n\n";
  const body = `export interface RepoStats {
  stars: number;
  lang: string | null;
  pushed_at: string;
}

export const repoStats: Record<string, RepoStats> = ${JSON.stringify(stats, null, 2)};
`;

  writeFileSync(outPath, header + body, "utf8");
}

function syncRepoStatsPlugin(): Plugin {
  return {
    name: "sync-repo-stats",
    buildStart() {
      syncRepoStats();
    },
  };
}

// Resolve the current HEAD's short SHA, message, and ISO timestamp at
// build/dev time. Surfaced in the terminal-panel dashboard so the
// "control console" widget shows real deploy info instead of a static
// placeholder. Falls back to "dev" markers if git isn't available
// (e.g. when the source has been extracted from a tarball).
function gitMetadata() {
  const tryRun = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch {
      return null;
    }
  };
  return {
    sha: tryRun("git rev-parse --short HEAD") ?? "dev",
    message: tryRun("git log -1 --pretty=%s") ?? "local development build",
    timestamp: tryRun("git log -1 --pretty=%cI") ?? new Date().toISOString(),
  };
}

const BUILD_META = gitMetadata();

// Inject the static SemanticContent HTML into index.html at build /
// dev time. The block sits as a sibling of #root so the React app
// never touches it on hydration — search engines, LLM agents, and
// screen readers see the full portfolio text at first byte.
function injectSemanticContent(): Plugin {
  return {
    name: "inject-semantic-content",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(
          '<div id="root"></div>',
          `<div id="root"></div>\n    ${buildSemanticContentHTML()}`,
        );
      },
    },
  };
}

// Replace the placeholder JSON-LD block in index.html with the
// generated Person + CreativeWork[] graph derived from projects.ts.
// Search by the surrounding script tag's text so we don't have to keep
// the placeholder JSON in sync.
function injectStructuredData(): Plugin {
  const open = '<script type="application/ld+json">';
  const close = "</script>";
  return {
    name: "inject-structured-data",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const start = html.indexOf(open);
        if (start === -1) return html;
        const end = html.indexOf(close, start);
        if (end === -1) return html;
        return (
          html.slice(0, start + open.length) +
          "\n" +
          buildStructuredDataJSON(BUILD_META.timestamp) +
          "\n    " +
          html.slice(end)
        );
      },
    },
  };
}

// Emit /llms.txt (llmstxt.org convention) from projects.ts at build time,
// and serve it during `vite dev`. Unlike the semantic-mirror and JSON-LD
// plugins (which rewrite index.html via transformIndexHtml), llms.txt is a
// standalone file — so it needs emitFile in generateBundle for the build
// output AND a configureServer middleware to resolve at /llms.txt locally.
function emitLlmsTxt(): Plugin {
  return {
    name: "emit-llms-txt",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/llms.txt") {
          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.end(buildLlmsTxt());
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "llms.txt",
        source: buildLlmsTxt(),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    injectSemanticContent(),
    injectStructuredData(),
    emitLlmsTxt(),
    syncRepoStatsPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  define: {
    __BUILD_SHA__: JSON.stringify(BUILD_META.sha),
    __BUILD_MESSAGE__: JSON.stringify(BUILD_META.message),
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_META.timestamp),
  },
  build: {
    target: "esnext",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three") || id.includes("node_modules/@react-three")) {
            return "vendor-three";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["e2e/**", ".features-gen/**", "node_modules/**"],
  },
});
