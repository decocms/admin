// Pure AI insights generator without workers runtime imports
export interface AiInsightsEnvLike { OPENROUTER_API_KEY?: string }
export interface AiInsightsAuditLike { url: string; scores?: any; linkSummary?: any; warnings?: string[] }
export interface RunAiInsightsPureParams { url: string; audit?: AiInsightsAuditLike; forceRefresh?: boolean }
export async function runAiInsightsPure(env: AiInsightsEnvLike, params: RunAiInsightsPureParams) {
  const { url, audit: providedAudit } = params;
  const warnings: string[] = [];
  const audit = providedAudit;
  if (!audit) return { url, summary: 'Não foi possível gerar auditoria para criar insights.', insights: [], modelUsed: 'none', warnings };
  const scores = audit.scores || {};
  const link = audit.linkSummary || {};
  const auditWarnings: string[] = audit.warnings || [];
  const heuristics: string[] = [];
  const pushIf = (c: any, m: string) => { if (c) heuristics.push(m); };
  pushIf(scores.performanceMobile != null && scores.performanceMobile < 60, 'Melhorar performance mobile priorizando LCP e TBT.');
  pushIf(scores.seoMobile != null && scores.seoMobile < 70, 'Revisar SEO on-page mobile; meta tags e estrutura semântica.');
  pushIf(link.brokenLinks > 0, `Corrigir ${link.brokenLinks} links quebrados.`);
  pushIf(link.imagesMissingAlt > 0, `${link.imagesMissingAlt} imagens sem alt — adicionar textos alternativos.`);
  pushIf(link.h1Count != null && link.h1Count !== 1, `Ajustar número de H1 (atual: ${link.h1Count}).`);
  pushIf(link.titleLength > 60, 'Título >60 caracteres; encurtar para melhor CTR.');
  pushIf(link.metaDescriptionLength && (link.metaDescriptionLength < 80 || link.metaDescriptionLength > 165), 'Meta description fora da faixa recomendada.');
  pushIf(link.wordCount && link.wordCount < 300, 'Conteúdo curto (<300 palavras); ampliar.');
  const insights = [...heuristics, ...auditWarnings.filter(w => !heuristics.some(h => h.includes(w)))].slice(0, 10);
  return { url, summary: 'Insights heurísticos baseados em métricas', insights, modelUsed: 'heuristic', warnings, rawAudit: audit };
}
