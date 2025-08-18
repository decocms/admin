// Pure AI insights generator without workers runtime imports
export interface AiInsightsEnvLike {
  OPENROUTER_API_KEY?: string;
  DECO_CHAT_API_TOKEN?: string;
  DECO_CHAT_API_URL?: string;
  DECO_CHAT_WORKSPACE?: string;
}
export interface AiInsightsAuditLike {
  url: string;
  scores?: any;
  linkSummary?: any;
  warnings?: string[];
}
export interface RunAiInsightsPureParams {
  url: string;
  audit?: AiInsightsAuditLike;
  forceRefresh?: boolean;
  fetchFn?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>; // injectable for tests
  enableLlm?: boolean; // force attempt even in pure runner
}
export async function runAiInsightsPure(
  env: AiInsightsEnvLike,
  params: RunAiInsightsPureParams,
) {
  const { url, audit: providedAudit, fetchFn, enableLlm } = params;
  const warnings: string[] = [];
  const audit = providedAudit;
  if (!audit) {
    return {
      url,
      summary: 'Não foi possível gerar auditoria para criar insights.',
      insights: [],
      modelUsed: 'none',
      warnings,
      llmTried: false,
      llmError: null,
    };
  }
  const scores = audit.scores || {};
  const link = audit.linkSummary || {};
  const auditWarnings: string[] = audit.warnings || [];
  const heuristics: string[] = [];
  const pushIf = (c: any, m: string) => {
    if (c) heuristics.push(m);
  };
  pushIf(
    scores.performanceMobile != null && scores.performanceMobile < 60,
    'Melhorar performance mobile priorizando LCP e TBT.',
  );
  pushIf(
    scores.seoMobile != null && scores.seoMobile < 70,
    'Revisar SEO on-page mobile; meta tags e estrutura semântica.',
  );
  pushIf(link.brokenLinks > 0, `Corrigir ${link.brokenLinks} links quebrados.`);
  pushIf(
    link.imagesMissingAlt > 0,
    `${link.imagesMissingAlt} imagens sem alt — adicionar textos alternativos.`,
  );
  pushIf(
    link.h1Count != null && link.h1Count !== 1,
    `Ajustar número de H1 (atual: ${link.h1Count}).`,
  );
  pushIf(
    link.titleLength > 60,
    'Título >60 caracteres; encurtar para melhor CTR.',
  );
  pushIf(
    link.metaDescriptionLength &&
      (link.metaDescriptionLength < 80 || link.metaDescriptionLength > 165),
    'Meta description fora da faixa recomendada.',
  );
  pushIf(
    link.wordCount && link.wordCount < 300,
    'Conteúdo curto (<300 palavras); ampliar.',
  );
  const insights = [
    ...heuristics,
    ...auditWarnings.filter((w) => !heuristics.some((h) => h.includes(w))),
  ].slice(0, 10);
  // Optional LLM path (only if enableLlm flag and key present)
  let modelUsed = 'heuristic';
  if (
    enableLlm && fetchFn && (env.DECO_CHAT_API_TOKEN || env.OPENROUTER_API_KEY)
  ) {
    const start = Date.now();
    try {
      const prompt =
        `Bullets SEO para ${url}: performanceMobile=${scores.performanceMobile} seoMobile=${scores.seoMobile}`;
      let txt = '';
      let usedModel = '';
      if (env.DECO_CHAT_API_TOKEN) {
        const { callDecoLlm } = await import('./decoLLM');
        const decoRes = await callDecoLlm(
          env as any,
          { prompt },
          fetchFn as any,
        );
        txt = decoRes.content;
        usedModel = decoRes.model || 'deco/auto';
      } else if (env.OPENROUTER_API_KEY) {
        const resp = await fetchFn(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'openrouter/auto',
              messages: [{ role: 'user', content: prompt }],
            }),
          },
        );
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const json = await resp.json();
        txt = json.choices?.[0]?.message?.content || '';
        usedModel = json.model || 'openrouter/auto';
      }
      const llmLines = txt
        .split(/\n+/)
        .map((l: string) => l.replace(/^[-*\d\.)\s]+/, '').trim())
        .filter((l: string) => l.length > 4)
        .slice(0, 10);
      const ms = Date.now() - start;
      try {
        (await import('./metricsLLMProxy'))?.recordLlmSuccess?.(ms);
      } catch {}
      if (llmLines.length) {
        return {
          url,
          summary: `Insights via LLM (${llmLines.length})`,
          insights: llmLines,
          modelUsed: usedModel || 'llm/auto',
          warnings,
          rawAudit: audit,
          llmTried: true,
          llmError: null,
        };
      }
    } catch (e) {
      const ms = Date.now() - start;
      try {
        (await import('./metricsLLMProxy'))?.recordLlmError?.(ms);
      } catch {}
      warnings.push(
        'Fallback heurístico (LLM falhou): ' + (e as Error).message,
      );
      return {
        url,
        summary: 'Insights heurísticos baseados em métricas',
        insights,
        modelUsed,
        warnings,
        rawAudit: audit,
        llmTried: true,
        llmError: (e as Error).message,
      };
    }
  }
  return {
    url,
    summary: 'Insights heurísticos baseados em métricas',
    insights,
    modelUsed,
    warnings,
    rawAudit: audit,
    llmTried: false,
    llmError: null,
  };
}
