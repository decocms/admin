import { createTool } from '@deco/workers-runtime/mastra';
import { z } from 'zod';
import { analyzeLinks } from '../link-analyzer/analyze';
import { createPageSpeedTool } from '../pagespeed';

const InputSchema = z.object({
  url: z.string().url(),
  includeRaw: z.boolean().optional().default(false),
});

const OutputSchema = z.object({
  url: z.string().url(),
  scores: z.object({
    seoScore: z.number().nullable().optional(),
    linkSeoScore: z.number().nullable().optional(),
    performanceMobile: z.number().nullable().optional(),
    performanceDesktop: z.number().nullable().optional(),
    seoMobile: z.number().nullable().optional(),
    seoDesktop: z.number().nullable().optional(),
  }),
  coreWebVitals: z.object({
    LCP_ms_mobile: z.number().nullable().optional(),
    LCP_ms_desktop: z.number().nullable().optional(),
    CLS_mobile: z.number().nullable().optional(),
    CLS_desktop: z.number().nullable().optional(),
    INP_ms_mobile: z.number().nullable().optional(),
  }),
  linkSummary: z.object({
    linksFound: z.number().optional(),
    brokenLinks: z.number().optional(),
    internalLinks: z.number().optional(),
    externalLinks: z.number().optional(),
    images: z.number().optional(),
    imagesMissingAlt: z.number().optional(),
    h1Count: z.number().optional(),
    titleLength: z.number().optional(),
    metaDescriptionLength: z.number().optional(),
    wordCount: z.number().optional(),
  }),
  warnings: z.array(z.string()),
  generatedAt: z.string(),
  raw: z.any().optional(),
});

export const createSeoAuditTool = (env: any) => {
  const pageSpeedTool = createPageSpeedTool(env);
  return createTool({
    id: 'SEO_AUDIT',
    description: 'Combines LINK_ANALYZER and PageSpeed (mobile+desktop) into a unified SEO audit',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
    execute: async ({ context }) => {
      const { url, includeRaw } = context;
      const warnings: string[] = [];
      const link = await analyzeLinks(url).catch(e => { warnings.push(`Link analyzer failed: ${(e as Error).message}`); return null; });
      let mobile: any = null;
      let desktop: any = null;
      try {
        mobile = await pageSpeedTool.execute({ context: { url, strategy: 'mobile', category: ['performance','seo'] } } as any);
      } catch (e) { warnings.push(`PageSpeed mobile error: ${(e as Error).message}`); }
      try {
        desktop = await pageSpeedTool.execute({ context: { url, strategy: 'desktop', category: ['performance','seo'] } } as any);
      } catch (e) { warnings.push(`PageSpeed desktop error: ${(e as Error).message}`); }
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
      const out = {
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
      };
      return out;
    }
  });
};

export type SeoAuditInput = z.infer<typeof InputSchema>;
export type SeoAuditOutput = z.infer<typeof OutputSchema>;
