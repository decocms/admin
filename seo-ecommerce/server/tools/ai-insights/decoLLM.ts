// Minimal adapter to call Deco.chat LLM endpoint (placeholder spec)
// Assumes env provides DECO_CHAT_API_URL (optional) and DECO_CHAT_API_TOKEN
export interface DecoLlmEnv {
  DECO_CHAT_API_URL?: string;
  DECO_CHAT_API_TOKEN?: string; // bearer token
  DECO_CHAT_WORKSPACE?: string; // optional workspace routing
}

export interface DecoLlmRequest {
  prompt: string;
  model?: string; // optional override
  temperature?: number;
  maxTokens?: number;
}

export interface DecoLlmResponse {
  model: string;
  content: string; // plain text combined
  raw?: any;
}

export async function callDecoLlm(
  env: DecoLlmEnv,
  req: DecoLlmRequest,
  fetchFn: typeof fetch = fetch,
): Promise<DecoLlmResponse> {
  if (!env.DECO_CHAT_API_TOKEN) throw new Error('Missing DECO_CHAT_API_TOKEN');
  const base = env.DECO_CHAT_API_URL || 'https://api.deco.chat';
  const url = base.replace(/\/$/, '') + '/v1/llm/chat'; // hypothetical endpoint
  const body = {
    model: req.model || 'auto',
    messages: [{ role: 'user', content: req.prompt }],
    temperature: req.temperature ?? 0.5,
    max_tokens: req.maxTokens ?? 512,
    workspace: env.DECO_CHAT_WORKSPACE,
  };
  const r = await fetchFn(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${env.DECO_CHAT_API_TOKEN}`,
      ...(env.DECO_CHAT_WORKSPACE ? { 'x-workspace': env.DECO_CHAT_WORKSPACE } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Deco LLM HTTP ${r.status}`);
  const json = await r.json();
  const model = json.model || body.model;
  // Simplify parsing (expect choices array similar to OpenAI style)
  const txt = json.choices?.map((c: any) => c.message?.content).join('\n') ||
    json.content || '';
  return { model, content: txt, raw: json };
}
