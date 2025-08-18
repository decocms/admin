import { describe, expect, it } from "vitest";
import { runSeoAuditPure } from "../runner";

describe("SEO_AUDIT clean site scenario", () => {
  it("produces no warnings with optimal metrics and no broken links", async () => {
    const url = "https://example.com";
    const analyzeLinks = async () => ({
      internal: ["https://example.com/a", "https://example.com/b"],
      external: ["https://external.com/"],
      broken: [],
      total: 3,
    });
    const getPageSpeed = async () => ({
      categories: {
        performance: 95,
        accessibility: 92,
        "best-practices": 90,
        seo: 90,
        pwa: 50,
      },
      metrics: {},
    });

    const result = await runSeoAuditPure(
      { analyzeLinks, getPageSpeed },
      { url },
    );
    expect(result.warnings).toEqual([]);
    expect(result.scores.performanceMobile).toBeGreaterThanOrEqual(0.9);
  });
});
