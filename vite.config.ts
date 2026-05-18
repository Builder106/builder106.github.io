import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import {
  buildSemanticContentHTML,
  buildStructuredDataJSON,
} from "./src/utils/semanticHtml";

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
          buildStructuredDataJSON() +
          "\n    " +
          html.slice(end)
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), injectSemanticContent(), injectStructuredData()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
