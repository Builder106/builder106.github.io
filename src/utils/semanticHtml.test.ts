import { describe, expect, it } from "vitest";
import {
  buildLlmsTxt,
  buildSemanticContentHTML,
  buildStructuredDataJSON,
} from "./semanticHtml";

describe("semanticHtml generator utilities", () => {
  it("buildSemanticContentHTML generates valid semantic HTML mirror", () => {
    const html = buildSemanticContentHTML();

    expect(html).toContain('<main class="sr-only"');
    expect(html).toContain("<h1>Olayinka David Vaughan</h1>");
    expect(html).toContain('<h2 id="projects-heading">Projects</h2>');
    expect(html).toContain('<h2 id="experience-heading">Experience</h2>');
    expect(html).toContain("quant cluster");
    expect(html).toContain("SWE cluster");
  });

  it("buildStructuredDataJSON generates valid JSON-LD graph", () => {
    const jsonStr = buildStructuredDataJSON("2026-07-21T00:00:00Z");
    const json = JSON.parse(jsonStr);

    expect(json["@context"]).toBe("https://schema.org");
    expect(Array.isArray(json["@graph"])).toBe(true);

    const graph = json["@graph"];
    const personNode = graph.find((node: { "@type": string }) => node["@type"] === "Person");
    expect(personNode).toBeDefined();
    expect(personNode.name).toBe("Olayinka David Vaughan");

    const profileNode = graph.find((node: { "@type": string }) => node["@type"] === "ProfilePage");
    expect(profileNode).toBeDefined();
    expect(profileNode.dateModified).toBe("2026-07-21T00:00:00Z");

    const itemListNode = graph.find((node: { "@type": string }) => node["@type"] === "ItemList");
    expect(itemListNode).toBeDefined();
    expect(itemListNode.numberOfItems).toBeGreaterThan(0);
  });

  it("buildLlmsTxt generates valid LLM markdown file content", () => {
    const llmsTxt = buildLlmsTxt();

    expect(llmsTxt).toContain("# Olayinka David Vaughan");
    expect(llmsTxt).toContain("## quant");
    expect(llmsTxt).toContain("## SWE");
    expect(llmsTxt).toContain("## Links");
    expect(llmsTxt).toContain("https://yinkavaughan.me");
  });
});
