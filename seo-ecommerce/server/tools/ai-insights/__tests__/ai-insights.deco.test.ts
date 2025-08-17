import { describe, it, expect } from "vitest";
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

describe("AI insights Deco LLM", () => {
  it("uses Deco LLM when token present", async () => {
    const fetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: "deco:test",
        choices: [ { message: { content: "- Otimizar imagens\n- Melhorar LCP" } } ],
      }),
    }) as any;
    const res = await runAiInsightsPure(
      { DECO_CHAT_API_TOKEN: "tok-test" },
      { url: baseAudit.url, audit: baseAudit as any, enableLlm: true, fetchFn },
    );
    expect(res.modelUsed).toContain("deco");
    expect(res.llmTried).toBe(true);
    expect(res.insights.length).toBeGreaterThan(0);
  });
  it("falls back to heuristics if Deco LLM fails", async () => {
    const fetchFn = async () => ({ ok: false, status: 500 }) as any;
    const res = await runAiInsightsPure(
      { DECO_CHAT_API_TOKEN: "tok-test" },
      { url: baseAudit.url, audit: baseAudit as any, enableLlm: true, fetchFn },
    );
    expect(res.modelUsed).toBe("heuristic");
    expect(res.llmTried).toBe(true);
    expect(res.insights.length).toBeGreaterThan(0);
    expect(res.llmError).toBeTruthy();
  });
});
