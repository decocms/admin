import { describe, expect, it } from "vitest";

// Este teste só roda quando RUN_NETWORK_TESTS=1 (ou true) para evitar chamadas externas em CI normal.
const run = /^1|true$/i.test(process.env.RUN_NETWORK_TESTS || "");
(run ? describe : describe.skip)("NETWORK integration minimal", () => {
  const targetUrl = process.env.NETWORK_TEST_URL || "https://example.com";

  it("PageSpeed + LinkAnalyzer minimal smoke", async () => {
    // Require API key only if present; otherwise we accept heuristic path.
    const psApi = new URL(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${
        new URLSearchParams({
          url: targetUrl,
          strategy: "mobile",
          category: "performance",
        }).toString()
      }`,
    );
    const psResp = await fetch(psApi.toString(), {
      headers: { Accept: "application/json" },
    });
    expect(psResp.status).toBe(200);
    const psJson: any = await psResp.json();
    expect(psJson.id || psJson.lighthouseResult?.requestedUrl).toBeTruthy();

    // Simple link analyzer: fetch raw HTML and ensure we got some content.
    const htmlResp = await fetch(targetUrl);
    expect(htmlResp.status).toBe(200);
    const html = await htmlResp.text();
    expect(html.length).toBeGreaterThan(100);
  });
});
