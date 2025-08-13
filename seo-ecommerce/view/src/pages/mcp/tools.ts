import type { APIRoute } from 'astro';

// Endpoint local de desenvolvimento para /mcp/tools com:
// - Proxy opcional para worker de produção
// - Stub consistente quando upstream indisponível
// - CORS simples permitindo POST local
// - HEAD para healthcheck leve

const FALLBACK = (import.meta as any).env?.PUBLIC_MCP_FALLBACK || 'https://seo-ecommerce.ggstv-fer.workers.dev';
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, max-age=0',
};

function cors(h: Record<string,string> = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...h,
  };
}

const TOOL_SCHEMA = {
  name: 'LINK_ANALYZER',
  description: 'Analisa link e retorna metadados extraídos (stub/proxy).',
  inputSchema: {
    type: 'object',
    required: ['url'],
    properties: {
      url: { type: 'string', format: 'uri' },
    },
  },
};

async function tryProxy(request: Request) {
  const target = FALLBACK.replace(/\/$/, '') + '/mcp/tools';
  const init: RequestInit = { method: request.method, headers: { 'Content-Type': 'application/json' } };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.text();
  const res = await fetch(target, init);
  if (!res.ok) throw new Error('Upstream ' + res.status);
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: cors({ ...JSON_HEADERS, 'X-Source': 'proxy' }),
  });
}

function stubList() {
  return new Response(
    JSON.stringify({ tools: [TOOL_SCHEMA], stub: true }),
    { status: 200, headers: cors({ ...JSON_HEADERS, 'X-Source': 'stub' }) },
  );
}

async function stubExecute(body: any) {
  if (!body || body.tool !== 'LINK_ANALYZER') {
    return new Response(JSON.stringify({ error: 'Tool inválida', allowed: ['LINK_ANALYZER'] }), {
      status: 400,
      headers: cors({ ...JSON_HEADERS, 'X-Source': 'stub' }),
    });
  }
  const url = body?.input?.url;
  if (typeof url !== 'string') {
    return new Response(JSON.stringify({ error: 'Input ausente: url' }), {
      status: 400,
      headers: cors({ ...JSON_HEADERS, 'X-Source': 'stub' }),
    });
  }
  let valid = true;
  try { new URL(url); } catch { valid = false; }
  if (!valid) {
    return new Response(JSON.stringify({ error: 'URL inválida' }), {
      status: 422,
      headers: cors({ ...JSON_HEADERS, 'X-Source': 'stub' }),
    });
  }
  const now = Date.now();
  // Metadados extras simulados
  const simulated = {
    title: 'Stub Link Analyzer',
    description: 'Resposta simulada local (upstream offline).',
    links: [url],
    fetchedAt: new Date(now).toISOString(),
    contentType: 'text/html',
    wordCount: Math.floor(200 + Math.random()*800),
    linkCount: 1,
    hash: [...crypto.getRandomValues(new Uint8Array(8))].map(b=>b.toString(16).padStart(2,'0')).join(''),
  };
  simulated.linkCount = simulated.links.length;
  return new Response(
    JSON.stringify({
      tool: 'LINK_ANALYZER',
      stub: true,
      input: { url },
      result: simulated,
    }),
    { status: 200, headers: cors({ ...JSON_HEADERS, 'X-Source': 'stub' }) },
  );
}

async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: cors() });
  }
  if (request.method === 'HEAD') {
    // Leve: só tenta upstream; em falha retorna stub minimal
    try {
      const upstream = await tryProxy(new Request(request.url, { method: 'GET' }));
      return upstream;
    } catch {
      return new Response('', { status: 200, headers: cors({ 'X-Source': 'stub' }) });
    }
  }
  if (request.method === 'GET') {
    try { return await tryProxy(request); } catch { return stubList(); }
  }
  if (request.method === 'POST') {
    try { return await tryProxy(request); } catch {
      let body: any = null;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: cors(JSON_HEADERS) });
      }
      return stubExecute(body);
    }
  }
  return new Response(JSON.stringify({ error: 'Método não suportado' }), { status: 405, headers: cors(JSON_HEADERS) });
}

export const GET: APIRoute = ({ request }) => handler(request);
export const POST: APIRoute = ({ request }) => handler(request);
export const HEAD: APIRoute = ({ request }) => handler(request);
export const OPTIONS: APIRoute = ({ request }) => handler(request);
