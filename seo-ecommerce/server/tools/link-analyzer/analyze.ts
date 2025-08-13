// Pure analysis logic kept separate so unit tests avoid importing workers runtime.
export interface LinkAnalysisResult {
  url: string;
  linksFound: number;
  brokenLinks: number;
  seoScore: number;
}

export function analyzeLinks(url: string): LinkAnalysisResult {
  // TODO: replace mocked values with real fetching + parsing.
  return {
    url,
    linksFound: 42,
    brokenLinks: 3,
    seoScore: 85,
  };
}
