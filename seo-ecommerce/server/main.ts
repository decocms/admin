// deno-lint-ignore-file require-await
import { withRuntime } from "@deco/workers-runtime";
import { toolFactories } from "./tools";
import { analyzeLinks } from './tools/link-analyzer/analyze';
import {
  createStepFromTool,
  createTool,
  createWorkflow,
} from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env as DecoEnv } from "./deco.gen.ts";

interface Env extends DecoEnv {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const createMyTool = (_env: Env) =>
  createTool({
    id: "MY_TOOL",
    description: "Say hello",
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ message: z.string() }),
    execute: async ({ context }) => ({
      message: `Hello, ${context.name}!`,
    }),
  });

const createMyWorkflow = (env: Env) => {
  const step = createStepFromTool(createMyTool(env));

  return createWorkflow({
    id: "MY_WORKFLOW",
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ message: z.string() }),
  })
    .then(step)
    .commit();
};

const fallbackToView = (viewPath: string = "/") => (req: Request, env: Env) => {
  const LOCAL_URL = "http://localhost:4000";
  const url = new URL(req.url);
  const host = (req.headers.get("origin") || req.headers.get("host")) || "";
  const useDevServer = host.includes("localhost");

  // In production we must NOT collapse every path to '/' or JS/CSS assets will
  // receive HTML (causing MIME type errors). We only serve index fallback for
  // navigational HTML requests that would otherwise 404 (handled implicitly by
  // static assets fetch below if missing).
  if (useDevServer) {
    const devReq = new Request(new URL(`${url.pathname}${url.search}`, LOCAL_URL), req);
    return fetch(devReq);
  }

  // Let the ASSETS binding attempt to serve the exact path first.
  return env.ASSETS.fetch(req).then(async (res) => {
    // If asset not found and looks like a browser navigation (no extension or .html), fallback to index route.
    if (res.status === 404) {
      const path = url.pathname;
      // Compatibility: if /assets/ hashed file 404s (hosting missing duplicate), retry under /_astro/
      if (path.startsWith('/assets/')) {
        const alt = path.replace('/assets/', '/_astro/');
        const altReq = new Request(new URL(alt + url.search, req.url), req);
        const altRes = await env.ASSETS.fetch(altReq);
        if (altRes.ok) {
          return applyCacheHeaders(altRes, alt, false);
        }
      }
      const hasExt = /\.[a-zA-Z0-9]{1,8}$/.test(path);
      const accept = req.headers.get('accept') || '';
      const wantsHtml = accept.includes('text/html');
      if (!hasExt && wantsHtml) {
        const indexReq = new Request(new URL(viewPath, req.url), req);
        const idx = await env.ASSETS.fetch(indexReq);
        return applyCacheHeaders(idx, url.pathname, true);
      }
    }
    return applyCacheHeaders(res, url.pathname, false);
  });
};

function applyCacheHeaders(res: Response, path: string, isFallback: boolean): Response {
  try {
    const ct = res.headers.get('content-type') || '';
    const newHeaders = new Headers(res.headers);
    const isHtml = ct.includes('text/html');
    const isHashedAsset = /\/(_astro|assets)\/.*\.[a-f0-9]{6,}\.[a-z0-9]+$/i.test(path);
    if (isHtml) {
      // Ensure fresh HTML after deploy
      newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
    } else if (isHashedAsset) {
      // Long-term cache for fingerprinted files
      if (!newHeaders.has('Cache-Control')) {
        newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
      }
    } else if (/\.(js|css|svg|png|jpg|jpeg|webp|gif|ico)$/i.test(path)) {
      if (!newHeaders.has('Cache-Control')) {
        newHeaders.set('Cache-Control', 'public, max-age=3600');
      }
    }
    if (isFallback) newHeaders.set('X-Fallback-Index', '1');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: newHeaders });
  } catch {
    return res;
  }
}

const { Workflow, ...baseRuntime } = withRuntime<Env>({
  workflows: [createMyWorkflow],
  tools: [createMyTool, ...toolFactories],
  fetch: fallbackToView("/"),
});

export { Workflow };

// Expose MCP tools list for self type generation
import { zodToJsonSchema } from "zod-to-json-schema";

const TOOLS_PATH = "/mcp/tools";

function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,HEAD",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    ...extra,
  };
}

async function listTools(env: Env) {
  const factories = [createMyTool, ...toolFactories];
  return factories.map((f) => {
    const tool = f(env as any);
    const inputSchema = tool.inputSchema && "_def" in tool.inputSchema
      ? zodToJsonSchema(tool.inputSchema as z.ZodTypeAny)
      : { type: "object", properties: {} };
    const outputSchema = tool.outputSchema && "_def" in tool.outputSchema
      ? zodToJsonSchema(tool.outputSchema as z.ZodTypeAny)
      : { type: "object", properties: {} };
    return {
      name: tool.id,
      description: tool.description,
      inputSchema,
      outputSchema,
    };
  });
}

const runtime = {
  ...baseRuntime,
  fetch: (req: Request, env: Env, ctx: any) => {
    const url = new URL(req.url);
    if (url.pathname === '/__build') {
      return (async () => {
        try {
          const infoReq = new Request(new URL('/build-info.json', req.url), req);
          const r = await env.ASSETS.fetch(infoReq);
          if (r.ok) {
            const headers = new Headers(r.headers);
            headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            return new Response(await r.text(), { status: 200, headers });
          }
        } catch {}
        return new Response(JSON.stringify({ error: 'build-info not found' }), { status: 404, headers: { 'content-type': 'application/json', 'Cache-Control': 'no-cache' } });
      })();
    }
    // Lightweight dev bypass endpoint avoids full runtime env validation
    if (url.pathname === '/dev/link-analyzer' && req.method === 'POST') {
      if (!(req.headers.get('host') || '').includes('localhost')) {
        return new Response(JSON.stringify({ error: 'Dev endpoint only available locally' }), { status: 403, headers: corsHeaders({ 'content-type': 'application/json' }) });
      }
      return (async () => {
        try {
          const body = await req.json().catch(()=>({}));
          const u = body.url || body.input?.url;
          if(!u) return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: corsHeaders({ 'content-type': 'application/json' }) });
          const result = await analyzeLinks(u);
          return new Response(JSON.stringify({ tool: 'LINK_ANALYZER', input: { url: u }, result, devBypass: true }), { status: 200, headers: corsHeaders({ 'content-type': 'application/json' }) });
        } catch(e){
          return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders({ 'content-type': 'application/json' }) });
        }
      })();
    }
    if (url.pathname === TOOLS_PATH) {
      return (async () => {
        if (req.method === "OPTIONS") {
          return new Response("", { status: 204, headers: corsHeaders() });
        }
        if (req.method === "GET" || req.method === "HEAD") {
          try {
            const tools = await listTools(env);
            return new Response(JSON.stringify({ tools }), {
              headers: corsHeaders({ "content-type": "application/json" }),
            });
          } catch (err) {
            return new Response(
              JSON.stringify({ error: (err as Error).message }),
              { status: 500, headers: corsHeaders({ "content-type": "application/json" }) },
            );
          }
        }
        if (req.method === "POST") {
          try {
            const body = await req.json().catch(() => ({}));
            const toolId = body.tool;
            const input = body.input || {};
            // Debug logging of incoming request (safe fields only)
            try {
              console.log('[MCP] Incoming tool request', { tool: toolId, keys: Object.keys(input || {}) });
            } catch {}
            const isLocal = (req.headers.get('host') || '').includes('localhost');
            if (isLocal && toolId === 'MY_TOOL') {
              return new Response(JSON.stringify({ tool: 'MY_TOOL', input, result: { message: `Hello, ${(input as any).name || 'world'}!` } }), { status: 200, headers: corsHeaders({ 'content-type': 'application/json' }) });
            }
            if (isLocal && toolId === 'LINK_ANALYZER') {
              try {
                if (!input.url) {
                  return new Response(JSON.stringify({ error: 'Missing url in input' }), { status: 400, headers: corsHeaders({ 'content-type': 'application/json' }) });
                }
                const result = await analyzeLinks((input as any).url);
                return new Response(JSON.stringify({ tool: 'LINK_ANALYZER', input, result }), { status: 200, headers: corsHeaders({ 'content-type': 'application/json' }) });
              } catch (e) {
                console.error('[MCP] Local bypass analyze error', e);
                return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders({ 'content-type': 'application/json' }) });
              }
            }
            if (!toolId) {
              console.error("[MCP] Missing 'tool' field", body);
              return new Response(
                JSON.stringify({ error: "Missing 'tool' field" }),
                { status: 400, headers: corsHeaders({ "content-type": "application/json" }) },
              );
            }
            const factories = [createMyTool, ...toolFactories];
            // Provide dummy environment variables in local dev to satisfy schema validation
            // Only if they are missing. These are placeholders; real values should be set in production via wrangler secrets/bindings.
            const devEnvKeys = [
              'CF_DISPATCH_NAMESPACE',
              'CF_ACCOUNT_ID',
              'CF_API_TOKEN',
              'SUPABASE_URL',
              'SUPABASE_SERVER_TOKEN',
              'TURSO_GROUP_DATABASE_TOKEN',
              'TURSO_ORGANIZATION',
              'OPENROUTER_API_KEY'
            ];
            // isLocal already computed above
            let toolEnv: any = env;
            if(isLocal){
              toolEnv = { ...env };
              for (const k of devEnvKeys) {
                if (!(k in toolEnv) || toolEnv[k] === undefined) {
                  toolEnv[k] = `dev-${k.toLowerCase()}`;
                }
              }
            }
            const factory = factories.find((f) => {
              try { return (f as any)(toolEnv).id === toolId; } catch { return false; }
            });
            if (!factory) {
              console.error(`[MCP] Tool '${toolId}' not found`, body);
              return new Response(
                JSON.stringify({ error: `Tool '${toolId}' not found` }),
                { status: 404, headers: corsHeaders({ "content-type": "application/json" }) },
              );
            }
            const tool = (factory as any)(toolEnv);
            try {
              const execStart = Date.now();
              let execution: any;
              // Fast-path bypass for local dev to skip env-heavy validation for simple tools
              if (isLocal && (toolId === 'LINK_ANALYZER' || toolId === 'MY_TOOL')) {
                if (toolId === 'MY_TOOL') {
                  execution = { message: `Hello, ${(input as any).name || 'world'}!` };
                } else if (toolId === 'LINK_ANALYZER') {
                  try {
                    const { analyzeLinks } = await import('./tools/link-analyzer/analyze');
                    execution = await analyzeLinks((input as any).url);
                  } catch (e) {
                    console.error('[MCP] Bypass analyze error', e);
                    throw e;
                  }
                }
              } else {
                execution = await tool.execute({ context: input });
              }
              const execMs = Date.now() - execStart;
              try { console.log('[MCP] Tool OK', { tool: tool.id, ms: execMs }); } catch {}
              const result = {
                ...execution,
                links: Array.isArray((execution as any).links) ? (execution as any).links : [],
              };
              return new Response(
                JSON.stringify({ tool: tool.id, input, result }),
                { status: 200, headers: corsHeaders({ "content-type": "application/json" }) },
              );
            } catch (toolErr) {
                const isZod = toolErr && typeof toolErr === 'object' && (toolErr as any).name === 'ZodError';
                const stack = toolErr && typeof toolErr === 'object' && 'stack' in toolErr ? (toolErr as any).stack : undefined;
                console.error('[MCP] Tool execution error:', toolErr, { toolId, input, isZod });
                if (stack) console.error('Stack trace:', stack);
                const statusCode = isZod ? 400 : 500;
                const payload: Record<string, unknown> = {
                  error: (toolErr as Error).message,
                  tool: tool.id,
                  input,
                  isZod,
                };
                if (isZod && (toolErr as any).issues) {
                  payload.issues = (toolErr as any).issues;
                }
                if (!isZod && stack) payload.details = stack;
                return new Response(
                  JSON.stringify(payload),
                  { status: statusCode, headers: corsHeaders({ "content-type": "application/json", 'X-Error-Type': isZod ? 'ZodError' : 'ToolError' }) },
                );
              }
          } catch (err) {
            console.error(`[MCP] Handler error`, err);
            return new Response(
              JSON.stringify({ error: (err as Error).message }),
              { status: 500, headers: corsHeaders({ "content-type": "application/json" }) },
            );
          }
        }
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers: corsHeaders({ "content-type": "application/json" }) },
        );
      })();
    }
    return (baseRuntime as any).fetch(req, env, ctx);
  },
};

export default runtime;
