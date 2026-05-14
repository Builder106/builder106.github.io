import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { buildSemanticContentHTML } from "./src/utils/semanticHtml";

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

export default defineConfig({
  plugins: [react(), injectSemanticContent()],
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
