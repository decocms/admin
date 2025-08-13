import type { APIRoute } from 'astro';

// Endpoint local para desenvolvimento: /mcp/tools
// Objetivos:
// 1. Evitar 404 no dev (probe do LinkAnalyzerForm)
// 2. Proxy para o worker de produção se disponível
// 3. Stub simples se produção indisponível

const PROD_FALLBACK = 'https://seo-ecommerce.ggstv-fer.workers.dev';

async function proxyOrStub(request: Request) {
  const url = new URL(request.url);
  const target = PROD_FALLBACK.replace(/\/$/, '') + url.pathname;
  try {
    const init: RequestInit = {
      method: request.method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.text();
    }
    const res = await fetch(target, init);
    if (!res.ok) throw new Error('Upstream status ' + res.status);
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Source': 'proxy' },
    });
  } catch (err) {
    // Fallback stub
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          tools: [
            {
              name: 'LINK_ANALYZER',
              description: 'Stub local: analisa link retornando metadados simulados.',
              inputSchema: {
                type: 'object',
                required: ['url'],
                properties: { url: { type: 'string', format: 'uri' } },
              },
            },
          ],
          stub: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'X-Source': 'stub' } },
      );
    }
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (body?.tool === 'LINK_ANALYZER' && body?.input?.url) {
          return new Response(
            JSON.stringify({
              tool: 'LINK_ANALYZER',
              stub: true,
              input: body.input.url,
              result: {
                title: 'Stub Link Analyzer',
                description: 'Resposta simulada local (upstream offline).',
                links: [body.input.url],
                timestamp: new Date().toISOString(),
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', 'X-Source': 'stub' } },
          );
        }
        return new Response(JSON.stringify({ error: 'Tool inválida ou input ausente.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'X-Source': 'stub' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'JSON inválido.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'X-Source': 'stub' },
        });
      }
    }
    return new Response('Método não suportado', { status: 405 });
  }
}

export const GET: APIRoute = async ({ request }) => proxyOrStub(request);
export const POST: APIRoute = async ({ request }) => proxyOrStub(request);
