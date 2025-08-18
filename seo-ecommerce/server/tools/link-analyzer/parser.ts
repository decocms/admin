// Pure HTML parsing helpers extracted from analyze.ts for deterministic unit tests (no network).
export interface ParsedHtmlMetrics {
  links: string[];
  internalLinks: number;
  externalLinks: number;
  title: string;
  metaDescription: string;
  canonical: string;
  h1Count: number;
  wordCount: number;
  images: number;
  imagesMissingAlt: number;
  titleLength: number;
  metaDescriptionLength: number;
}

// Anchor extraction with simple regex (kept lightweight). Ignores fragments, mailto, javascript.
function extractLinks(html: string, base: URL): string[] {
  const links = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("mailto:") || raw.startsWith("javascript:")) {
      continue;
    }
    try {
      const abs = new URL(raw, base).toString();
      links.add(abs);
    } catch {
      /* ignore invalid URL */
    }
    if (links.size >= 500) break; // safety cap
  }
  return Array.from(links);
}

export function parseHtml(html: string, baseUrl: string): ParsedHtmlMetrics {
  const base = new URL(baseUrl);
  const links = extractLinks(html, base);
  const origin = base.origin;
  let internalLinks = 0;
  let externalLinks = 0;
  links.forEach((l) => {
    if (l.startsWith(origin)) internalLinks++;
    else externalLinks++;
  });

  // Metadata extraction (regex based to avoid heavy DOM dependency)
  let title = "";
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  if (titleMatch) title = titleMatch[1].trim();
  let metaDescription = "";
  const metaDescMatch = /<meta[^>]*name=["']description["'][^>]*>/i.exec(html);
  if (metaDescMatch) {
    const attrMatch = /content=["']([^"']*)["']/i.exec(metaDescMatch[0]);
    if (attrMatch) metaDescription = attrMatch[1].trim();
  }
  let canonical = "";
  const canonicalMatch = /<link[^>]*rel=["']canonical["'][^>]*>/i.exec(html);
  if (canonicalMatch) {
    const hrefMatch = /href=["']([^"']+)["']/i.exec(canonicalMatch[0]);
    if (hrefMatch) {
      try {
        canonical = new URL(hrefMatch[1], base).toString();
      } catch {}
    }
  }
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  let wordCount = 0;
  if (html) {
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ");
    wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  }
  let images = 0;
  let imagesMissingAlt = 0;
  const imgRe = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRe.exec(html))) {
    images++;
    const tag = imgMatch[0];
    if (!/alt=\s*["'][^"']*["']/i.test(tag)) imagesMissingAlt++;
    if (images >= 500) break;
  }
  return {
    links,
    internalLinks,
    externalLinks,
    title,
    metaDescription,
    canonical,
    h1Count,
    wordCount,
    images,
    imagesMissingAlt,
    titleLength: title.length,
    metaDescriptionLength: metaDescription.length,
  };
}
