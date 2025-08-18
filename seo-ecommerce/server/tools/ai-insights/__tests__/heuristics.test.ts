import { describe, expect, it } from "vitest";
import { runAiInsightsPure as runAiInsights } from "../../ai-insights/runner";

const mockAudit = {
  url: "https://example.com",
  scores: { performanceMobile: 45, seoMobile: 65 },
  linkSummary: {
    brokenLinks: 2,
    imagesMissingAlt: 1,
    h1Count: 3,
    titleLength: 70,
    metaDescriptionLength: 40,
    wordCount: 200,
  },
  warnings: ["Broken links detectados: 2"],
};

describe("AI_INSIGHTS heuristics fallback", () => {
  it("generates heuristic insights without LLM key", async () => {
    const out = await runAiInsights(
      {},
      { url: mockAudit.url, audit: mockAudit },
    );
    expect(out.insights.length).toBeGreaterThan(0);
    const joined = out.insights.join(" ");
    expect(joined).toMatch(/performance mobile/i);
    expect(joined).toMatch(/links quebrados/i);
  });
});
