import { describe, it, expect } from "vitest";
import { runAiInsightsPure as runAiInsights } from "../../ai-insights/runner";

// Mock fetch to simulate LLM failure
function withPatchedFetch(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<void>,
) {
  const orig = (globalThis as any).fetch;
  (globalThis as any).fetch = impl;
  return fn().finally(() => {
    (globalThis as any).fetch = orig;
  });
}

describe("AI_INSIGHTS heuristics (pure, no LLM)", () => {
  it("produces heuristic insights even if LLM env key provided", async () => {
    const audit = {
      url: "https://example.com",
      scores: { performanceMobile: 40, seoMobile: 60 },
      linkSummary: {
        brokenLinks: 1,
        imagesMissingAlt: 2,
        h1Count: 2,
        titleLength: 70,
        metaDescriptionLength: 40,
        wordCount: 250,
      },
      warnings: ["Broken links detectados: 1"],
    };
    const out = await runAiInsights(
      { OPENROUTER_API_KEY: "dummy" },
      { url: audit.url, audit },
    );
    expect(out.modelUsed).toBe("heuristic");
    expect(out.insights.length).toBeGreaterThan(0);
    expect(out.warnings.length).toBe(0);
  });
});
