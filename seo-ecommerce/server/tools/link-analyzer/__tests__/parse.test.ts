import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHtml } from "../parser";

const fx = (name: string) =>
  readFileSync(join(__dirname, "..", "__fixtures__", name), "utf-8");

describe("parseHtml (pure)", () => {
  it("parses basic metadata & links from simple.html", () => {
    const html = fx("simple.html");
    const out = parseHtml(html, "https://example.com");
    expect(out.links.length).toBe(2);
    expect(out.internalLinks).toBe(1);
    expect(out.externalLinks).toBe(1);
    expect(out.title).toBe("Example Title");
    expect(out.metaDescription).toMatch(/Short description/);
    expect(out.canonical).toBe("https://example.com/canonical-url");
    expect(out.h1Count).toBe(1);
    expect(out.images).toBe(1);
    expect(out.imagesMissingAlt).toBe(0);
    expect(out.wordCount).toBeGreaterThanOrEqual(4);
  });

  it("counts missing alt images (alts.html)", () => {
    const html = fx("alts.html");
    const out = parseHtml(html, "https://example.com");
    expect(out.images).toBe(3);
    expect(out.imagesMissingAlt).toBe(2);
    expect(out.title).toBe("Imgs");
  });
});
