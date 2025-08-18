import { describe, expect, it } from "vitest";
import { runAiInsightsPure } from "../runner";

const baseAudit = {
  url: "https://example.com",
  scores: { performanceMobile: 40, seoMobile: 65 },
  linkSummary: {
    brokenLinks: 1,
    imagesMissingAlt: 2,
    h1Count: 2,
    titleLength: 70,
    metaDescriptionLength: 50,
    wordCount: 250,
  },
  warnings: ["Broken links detectados: 1"],
};

describe("AI insights LLM fallback", () => {
  it("falls back to heuristics on LLM error", async () => {
    const fetchFn = async () => ({ ok: false, status: 500 }) as any;
    const res = await runAiInsightsPure(
      { OPENROUTER_API_KEY: "sk-test" },
      { url: baseAudit.url, audit: baseAudit as any, enableLlm: true, fetchFn },
    );
    expect(res.modelUsed).toBe("heuristic");
    expect(res.llmTried).toBe(true);
    expect(res.llmError).toBeTruthy();
    expect(res.insights.length).toBeGreaterThan(0);
  });
  it("uses LLM when successful", async () => {
    const fetchFn = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "- Otimizar imagens\n- Reduzir LCP\n- Melhorar meta tags",
              },
            },
          ],
          model: "test-model",
        }),
      }) as any;
    const res = await runAiInsightsPure(
      { OPENROUTER_API_KEY: "sk-test" },
      { url: baseAudit.url, audit: baseAudit as any, enableLlm: true, fetchFn },
    );
    expect(res.modelUsed).toBe("test-model");
    expect(res.insights).toContain("Otimizar imagens");
    expect(res.llmTried).toBe(true);
    expect(res.llmError).toBeNull();
  });
});
