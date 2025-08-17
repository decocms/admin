import { createTool } from '@deco/workers-runtime/mastra';
import { z } from 'zod';
import { createSeoAuditTool } from '../seo-audit';

const InputSchema = z.object({
  url: z.string().url(),
  audit: z.any().optional(),
  forceRefresh: z.boolean().optional().default(false),
});

const OutputSchema = z.object({
  url: z.string().url(),
  summary: z.string(),
  insights: z.array(z.string()),
  modelUsed: z.string(),
  warnings: z.array(z.string()).default([]),
  rawAudit: z.any().optional(),
});

interface EnvLike {
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export async function runAiInsights(env: EnvLike, params: { url: string; audit?: any; forceRefresh?: boolean }) {
  const { url, audit: providedAudit, forceRefresh } = params;
  const warnings: string[] = [];
  let audit = providedAudit;
  const seoAuditTool = createSeoAuditTool(env as any);
  if (!audit || forceRefresh) {
    try { audit = await seoAuditTool.execute({ context: { url } } as any); }
    catch (e) { warnings.push('Falha ao obter auditoria automática: ' + (e as Error).message); }
  }
  if (!audit) {
    return { url, summary: 'Não foi possível gerar auditoria para criar insights.', insights: [], modelUsed: 'none', warnings };
  }
  const scores = audit.scores || {};
  const link = audit.linkSummary || {};
  const auditWarnings: string[] = audit.warnings || [];
  const heuristics: string[] = [];
  const pushIf = (cond: any, msg: string) => { if (cond) heuristics.push(msg); };
  pushIf(scores.performanceMobile != null && scores.performanceMobile < 60, 'Melhorar performance mobile priorizando LCP e TBT.');
  pushIf(scores.seoMobile != null && scores.seoMobile < 70, 'Revisar SEO on-page mobile; meta tags e estrutura semântica.');
  pushIf(link.brokenLinks > 0, `Corrigir ${link.brokenLinks} links quebrados.`);
  pushIf(link.imagesMissingAlt > 0, `${link.imagesMissingAlt} imagens sem alt — adicionar textos alternativos.`);
  pushIf(link.h1Count != null && link.h1Count !== 1, `Ajustar número de H1 (atual: ${link.h1Count}).`);
  pushIf(link.titleLength > 60, 'Título >60 caracteres; encurtar para melhor CTR.');
  pushIf(link.metaDescriptionLength && (link.metaDescriptionLength < 80 || link.metaDescriptionLength > 165), 'Meta description fora da faixa recomendada.');
  pushIf(link.wordCount && link.wordCount < 300, 'Conteúdo curto (<300 palavras); ampliar.');
  const prompt = `Gere recomendações SEO concisas (bullet points) para a página ${url}.\n`+
    `Performance Mobile: ${scores.performanceMobile}\nPerformance Desktop: ${scores.performanceDesktop}\n`+
    `SEO Mobile: ${scores.seoMobile}\nSEO Desktop: ${scores.seoDesktop}\nBroken Links: ${link.brokenLinks}\n`+
    `Images Missing Alt: ${link.imagesMissingAlt}\nH1 Count: ${link.h1Count}\nTitle Length: ${link.titleLength}\n`+
    `Meta Description Length: ${link.metaDescriptionLength}\nWord Count: ${link.wordCount}\nAlertas: ${(auditWarnings||[]).join('; ')}\n`+
    `Gere 5-8 bullets práticos em pt-BR, evitando repetir números; focar em ações priorizadas.`;
  let insights: string[] = [];
  let summary = '';
  let modelUsed = 'heuristic';
  const openRouterKey = env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openRouterKey}` },
        body: JSON.stringify({
          model: 'openrouter/auto',
          messages: [
            { role: 'system', content: 'Você é um especialista em SEO técnico e performance web.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,
        }),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      const txt = json.choices?.[0]?.message?.content || '';
      const lines = txt.split(/\n+/).map((l: string) => l.replace(/^[-*\d\.)\s]+/,'').trim()).filter((l: string) => l.length > 4);
      insights = lines.slice(0, 12);
      summary = `Gerado via LLM (${insights.length} itens)`;
      modelUsed = json.model || 'openrouter/auto';
    } catch (e) {
      warnings.push('Fallback heurístico (LLM falhou): ' + (e as Error).message);
    }
  }
  if (insights.length === 0) {
    insights = [...heuristics, ...auditWarnings.filter(w => !heuristics.some(h => h.includes(w)))].slice(0, 10);
    summary = 'Insights heurísticos baseados em métricas';
  }
  return { url, summary, insights, modelUsed, warnings, rawAudit: audit };
}

export const createAiInsightsTool = (env: EnvLike) => createTool({
  id: 'AI_INSIGHTS',
  description: 'Gera recomendações de SEO baseadas na auditoria (links + performance). Usa LLM se disponível, senão heurísticas locais.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: async ({ context }) => runAiInsights(env, context)
});

export type AiInsightsInput = z.infer<typeof InputSchema>;
export type AiInsightsOutput = z.infer<typeof OutputSchema>;
