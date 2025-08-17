// Pure, dependency-injected SEO audit runner (no workers runtime imports)
// Allows unit tests to bypass createTool / runtime side-effects.
import type { SeoAuditOutput } from './index';

export interface SeoAuditDeps {
  analyzeLinks: (url: string) => Promise<any>;
  getPageSpeed: (opts: { url: string; strategy: 'mobile'|'desktop' }) => Promise<any>;
}

export interface RunSeoAuditParams { url: string; includeRaw?: boolean }

export async function runSeoAuditPure(deps: SeoAuditDeps, params: RunSeoAuditParams): Promise<SeoAuditOutput> {
  const { url, includeRaw } = params;
  const { analyzeLinks, getPageSpeed } = deps;
  const warnings: string[] = [];
  const link = await analyzeLinks(url).catch(e => { warnings.push(`Link analyzer failed: ${(e as Error).message}`); return null; });
  const [mobile, desktop] = await Promise.all([
    getPageSpeed({ url, strategy: 'mobile' }).catch(e => { warnings.push(`PageSpeed mobile error: ${(e as Error).message}`); return null; }),
    getPageSpeed({ url, strategy: 'desktop' }).catch(e => { warnings.push(`PageSpeed desktop error: ${(e as Error).message}`); return null; }),
  ]);
  const performanceMobile = mobile?.categories?.performance ?? null;
  const performanceDesktop = desktop?.categories?.performance ?? null;
  const seoMobile = mobile?.categories?.seo ?? null;
  const seoDesktop = desktop?.categories?.seo ?? null;
  const linkSeoScore = link?.seoScore ?? null;
  const LCP_ms_mobile = mobile?.metrics?.LCP_ms ?? null;
  const LCP_ms_desktop = desktop?.metrics?.LCP_ms ?? null;
  const CLS_mobile = mobile?.metrics?.CLS ?? null;
  const CLS_desktop = desktop?.metrics?.CLS ?? null;
  const INP_ms_mobile = mobile?.metrics?.INP_ms ?? null;
  if (typeof link?.brokenLinks === 'number' && link.brokenLinks > 0) warnings.push(`Broken links detectados: ${link.brokenLinks}`);
  if (LCP_ms_mobile && LCP_ms_mobile > 4000) warnings.push('LCP mobile > 4s');
  if (CLS_mobile && CLS_mobile > 0.1) warnings.push('CLS mobile > 0.1');
  if (performanceMobile !== null && performanceMobile < 50) warnings.push('Performance mobile baixa (<50)');
  if (seoMobile !== null && seoMobile < 70) warnings.push('Score SEO mobile baixo (<70)');
  if (link?.imagesMissingAlt && link.imagesMissingAlt > 0) warnings.push(`Imagens sem alt: ${link.imagesMissingAlt}`);
  if (link?.h1Count && link.h1Count !== 1) warnings.push(`Quantidade de H1 = ${link.h1Count}`);
  if (link?.titleLength && link.titleLength > 60) warnings.push('Título > 60 caracteres');
  if (link?.metaDescriptionLength && (link.metaDescriptionLength < 80 || link.metaDescriptionLength > 165)) warnings.push('Meta description fora da faixa 80-165');
  return {
    url,
    scores: {
      seoScore: linkSeoScore,
      linkSeoScore,
      performanceMobile,
      performanceDesktop,
      seoMobile,
      seoDesktop,
    },
    coreWebVitals: {
      LCP_ms_mobile,
      LCP_ms_desktop,
      CLS_mobile,
      CLS_desktop,
      INP_ms_mobile,
    },
    linkSummary: link ? {
      linksFound: link.linksFound,
      brokenLinks: link.brokenLinks,
      internalLinks: link.internalLinks,
      externalLinks: link.externalLinks,
      images: link.images,
      imagesMissingAlt: link.imagesMissingAlt,
      h1Count: link.h1Count,
      titleLength: link.titleLength,
      metaDescriptionLength: link.metaDescriptionLength,
      wordCount: link.wordCount,
    } : {},
    warnings,
    generatedAt: new Date().toISOString(),
    raw: includeRaw ? { link, mobile, desktop } : undefined,
  } as SeoAuditOutput;
}
