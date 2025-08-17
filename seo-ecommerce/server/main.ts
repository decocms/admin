// deno-lint-ignore-file require-await
import { withRuntime } from "@deco/workers-runtime";
import { logSafe } from "@deco/workers-runtime/logSafe";
import { cacheMetricsSnapshot } from "./tools/cache";
import { toolMetricsSnapshot, recordToolError, recordToolSuccess } from "./tools/metrics";
import { toolFactories } from "./tools";
import { analyzeLinks } from "./tools/link-analyzer/analyze";
import { createPageSpeedTool } from "./tools/pagespeed";
import { createSeoAuditTool } from "./tools/seo-audit";
import {
  createStepFromTool,
  createTool,
  createWorkflow,
} from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env as DecoEnv } from "./deco.gen.ts";

interface Env extends DecoEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
}

// logSafe now imported from shared runtime module

// Validate critical secrets in production (non-localhost) once per instance
function validateCoreSecrets(env: Env, host: string | null): string[] {
  const missing: string[] = [];
  const isLocal = host ? host.includes("localhost") : false;
  if (isLocal) return missing;
  // Accept synonym names used across different workflows
  const groups: { keys: string[]; label: string; required: boolean }[] = [
    {
      keys: ["CF_API_TOKEN", "CLOUDFLARE_API_TOKEN"],
      label: "CF_API_TOKEN",
      required: true,
    },
    {
      keys: ["CF_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"],
      label: "CF_ACCOUNT_ID",
      required: true,
    },
    { keys: ["SUPABASE_URL"], label: "SUPABASE_URL", required: true },
    {
      keys: ["SUPABASE_SERVER_TOKEN"],
      label: "SUPABASE_SERVER_TOKEN",
      required: true,
    },
  ];
  for (const g of groups) {
    if (!g.required) continue;
    const hasAny = g.keys.some(
      (k) => (env as any)[k] && (env as any)[k] !== "",
    );
    if (!hasAny) missing.push(g.label);
  }
  return missing;
}

// Workflow wrapper for SEO_AUDIT tool (single step for now)
const createSeoAuditWorkflow = (env: Env) => {
  const seoTool = createSeoAuditTool(env);
  const Step = createStepFromTool(seoTool);
  return createWorkflow({
    id: "SEO_AUDIT_WORKFLOW",
    inputSchema: seoTool.inputSchema,
    outputSchema: seoTool.outputSchema,
  })
    .then(Step)
    .commit();
};

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

// (Removed broken composed version; future enhancement.)

// Lazy dynamic loader for Astro's generated Cloudflare worker (dynamic routes)
// Built by Astro into ./view-build/_worker.js (output: server)
// We call it only when we have a 404 from static assets & need HTML route resolution.
let astroFetchPromise: Promise<
  ((req: Request, env: Env, ctx: unknown) => Promise<Response>) | null
> | null = null;
async function loadAstroFetch(): Promise<
  ((req: Request, env: Env, ctx: unknown) => Promise<Response>) | null
> {
  if (!astroFetchPromise) {
    astroFetchPromise = import("./view-build/_worker.js")
      .then((m: any) => {
        const mod = m?.default || m;
        if (mod && typeof mod.fetch === "function") return mod.fetch.bind(mod);
        if (typeof m.fetch === "function") return m.fetch.bind(m);
        return null;
      })
      .catch(() => null);
  }
  return astroFetchPromise;
}

const fallbackToView =
  (viewPath: string = "/") =>
  async (req: Request, env: Env, ctx?: unknown) => {
    const LOCAL_URL = "http://localhost:4000";
    const url = new URL(req.url);
    const host = req.headers.get("origin") || req.headers.get("host") || "";
    const useDevServer = host.includes("localhost");

    // API/tool endpoints should never be routed through asset fallback logic.
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/mcp/")) {
      return env.ASSETS.fetch(req); // API & MCP handled elsewhere / by explicit routes
    }

    // In production we must NOT collapse every path to '/' or JS/CSS assets will
    // receive HTML (causing MIME type errors). We only serve index fallback for
    // navigational HTML requests that would otherwise 404 (handled implicitly by
    // static assets fetch below if missing).
    if (useDevServer) {
      const devReq = new Request(
        new URL(`${url.pathname}${url.search}`, LOCAL_URL),
        req,
      );
      return fetch(devReq);
    }

    // Let the ASSETS binding attempt to serve the exact path first.
    const assetRes = await env.ASSETS.fetch(req);
    if (assetRes.status !== 404) {
      return applyCacheHeaders(assetRes, url.pathname, false);
    }
    const path = url.pathname;
    const hasExt = /\.[a-zA-Z0-9]{1,8}$/.test(path);
    const accept = req.headers.get("accept") || "";
    const wantsHtml = accept.includes("text/html");
    if (!hasExt && wantsHtml) {
      // Attempt dynamic route resolution via Astro server worker
      try {
        const astroFetch = await loadAstroFetch();
        if (astroFetch) {
          const astroRes = await astroFetch(req, env, ctx as any);
          if (astroRes && astroRes.status !== 404) {
            return applyCacheHeaders(astroRes, url.pathname, false);
          }
        }
      } catch (e) {
        logSafe.error("[router] dynamic astro fetch failed", {
          error: (e as Error).message,
        });
      }
      // Final fallback: index.html for SPA navigation
      const indexReq = new Request(new URL(viewPath, req.url), req);
      const idx = await env.ASSETS.fetch(indexReq);
      return applyCacheHeaders(idx, url.pathname, true);
    }
    return applyCacheHeaders(assetRes, url.pathname, false);
  };

function applyCacheHeaders(
  res: Response,
  path: string,
  isFallback: boolean,
): Response {
  try {
    const ct = res.headers.get("content-type") || "";
    const newHeaders = new Headers(res.headers);
    const isHtml = ct.includes("text/html");
    const isHashedAsset =
      /\/(_astro|assets)\/.*\.[a-f0-9]{6,}\.[a-z0-9]+$/i.test(path);
    if (isHtml) {
      // Ensure fresh HTML after deploy
      newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
      newHeaders.set("Pragma", "no-cache");
      newHeaders.set("Expires", "0");
    } else if (isHashedAsset) {
      // Long-term cache for fingerprinted files
      if (!newHeaders.has("Cache-Control")) {
        newHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
      }
    } else if (/\.(js|css|svg|png|jpg|jpeg|webp|gif|ico)$/i.test(path)) {
      if (!newHeaders.has("Cache-Control")) {
        newHeaders.set("Cache-Control", "public, max-age=3600");
      }
    }
    if (isFallback) newHeaders.set("X-Fallback-Index", "1");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } catch {
    return res;
  }
}

const { Workflow, ...baseRuntime } = withRuntime<Env>({
  workflows: [createMyWorkflow, createSeoAuditWorkflow],
  tools: [createMyTool, ...toolFactories],
  // Pass wrapper that includes ctx to fallback (needed for astro dynamic invocation)
  fetch: (req: Request, env: Env, ctx: unknown) =>
    fallbackToView("/")(req, env, ctx),
});

export { Workflow };

// Expose MCP tools list for self type generation
import { zodToJsonSchema } from "zod-to-json-schema";

const TOOLS_PATH = "/mcp/tools";

function corsHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
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
    const inputSchema =
      tool.inputSchema && "_def" in tool.inputSchema
        ? zodToJsonSchema(tool.inputSchema as z.ZodTypeAny)
        : { type: "object", properties: {} };
    const outputSchema =
      tool.outputSchema && "_def" in tool.outputSchema
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
  // Uptime marker
  const startedAt = (globalThis as any).__APP_STARTED_AT || ((globalThis as any).__APP_STARTED_AT = Date.now());
    // Early secret validation (once per request path) for production clarity
    const host = req.headers.get("host");
    const missing = validateCoreSecrets(env, host);
    if (missing.length) {
      // Only block MCP/tool and API endpoints; allow static assets to still serve a maintenance page if desired
      if (url.pathname.startsWith("/mcp") || url.pathname.startsWith("/api")) {
        return new Response(
          JSON.stringify({
            error: "Missing required production secrets",
            missing,
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json",
              "Cache-Control": "no-cache",
            },
          },
        );
      }
    }
    // Minimal JSON endpoint to expose selected PUBLIC_ env vars to client when they were not inlined at build time.
    if (url.pathname === "/__env") {
      return new Response(
        JSON.stringify({
          PUBLIC_SUPABASE_URL: env.PUBLIC_SUPABASE_URL || null,
          PUBLIC_SUPABASE_ANON_KEY: env.PUBLIC_SUPABASE_ANON_KEY || null,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      );
    }
    if (url.pathname === "/__build") {
      return (async () => {
        try {
          const infoReq = new Request(
            new URL("/build-info.json", req.url),
            req,
          );
          const r = await env.ASSETS.fetch(infoReq);
          if (r.ok) {
            const headers = new Headers(r.headers);
            headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
            return new Response(await r.text(), { status: 200, headers });
          }
        } catch {}
        return new Response(JSON.stringify({ error: "build-info not found" }), {
          status: 404,
          headers: {
            "content-type": "application/json",
            "Cache-Control": "no-cache",
          },
        });
      })();
    }
    if (url.pathname === "/__metrics") {
      const snapshot = cacheMetricsSnapshot();
      const tools = toolMetricsSnapshot();
      return new Response(JSON.stringify({ cache: snapshot, tools }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }
    if (url.pathname === "/__health") {
      // Simple in-memory token bucket (reset each minute per isolate)
      const bucket = (globalThis as any).__HL_BUCKET || ((globalThis as any).__HL_BUCKET = { ts: Date.now(), tokens: 60 });
      const nowTs = Date.now();
      if (nowTs - bucket.ts > 60_000) {
        bucket.ts = nowTs;
        bucket.tokens = 60;
      }
      if (bucket.tokens <= 0) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "Retry-After": "30",
            "Cache-Control": "no-cache",
          },
        });
      }
      bucket.tokens--;
      const cache = cacheMetricsSnapshot();
      const tools = toolMetricsSnapshot();
      const host = req.headers.get("host") || "";
      const missingSecrets = validateCoreSecrets(env, host);
      const uptimeSec = (Date.now() - startedAt) / 1000;
      let status: "ok" | "degraded" = "ok";
      const warnings: string[] = [];
      if (missingSecrets.length) {
        status = "degraded";
        warnings.push(`Missing secrets: ${missingSecrets.join(",")}`);
      }
      for (const [toolId, m] of Object.entries(tools)) {
        if (m.calls >= 5 && m.errorRate != null && m.errorRate > 0.5) {
          status = "degraded";
          warnings.push(`High errorRate ${toolId}=${(m.errorRate * 100).toFixed(0)}%`);
        }
      }
  const buildId = (globalThis as any).__BUILD_ID__ || (globalThis as any).BUILD_ID || null;
      const body = { status, buildId, uptimeSec, startedAt, cache, tools, missingSecrets, warnings };
      return new Response(JSON.stringify(body), {
        status: status === "ok" ? 200 : 503,
        headers: {
          "content-type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-RateLimit-Remaining": String(bucket.tokens),
        },
      });
    }
    // Direct analyze endpoint (mirrors view /api/analisar) so production worker serves it without relying on view server bundle
    if (url.pathname === "/api/analisar") {
      if (req.method === "OPTIONS") {
        return new Response("", {
          status: 204,
          headers: corsHeaders({
            "Access-Control-Allow-Methods": "POST,OPTIONS",
          }),
        });
      }
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: corsHeaders({ "content-type": "application/json" }),
        });
      }
      return (async () => {
        try {
          const body = await req.json().catch(() => ({}));
          const rawUrl = body.url || body.input?.url;
            if (!rawUrl || typeof rawUrl !== "string") {
            return new Response(JSON.stringify({ error: "url requerida" }), {
              status: 400,
              headers: corsHeaders({ "content-type": "application/json" }),
            });
          }
          const result = await analyzeLinks(rawUrl);
          return new Response(
            JSON.stringify({ url: rawUrl, result, worker: true }),
            {
              status: 200,
              headers: corsHeaders({ "content-type": "application/json" }),
            },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ error: (e as Error).message || "falha" }),
            {
              status: 500,
              headers: corsHeaders({ "content-type": "application/json" }),
            },
          );
        }
      })();
    }
    // Lightweight dev bypass endpoint avoids full runtime env validation
    if (url.pathname === "/dev/link-analyzer" && req.method === "POST") {
      if (!(req.headers.get("host") || "").includes("localhost")) {
        return new Response(
          JSON.stringify({ error: "Dev endpoint only available locally" }),
          {
            status: 403,
            headers: corsHeaders({ "content-type": "application/json" }),
          },
        );
      }
      return (async () => {
        try {
          const body = await req.json().catch(() => ({}));
          const u = body.url || body.input?.url;
          if (!u)
            return new Response(JSON.stringify({ error: "Missing url" }), {
              status: 400,
              headers: corsHeaders({ "content-type": "application/json" }),
            });
          const result = await analyzeLinks(u);
          return new Response(
            JSON.stringify({
              tool: "LINK_ANALYZER",
              input: { url: u },
              result,
              devBypass: true,
            }),
            {
              status: 200,
              headers: corsHeaders({ "content-type": "application/json" }),
            },
          );
        } catch (e) {
          return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 500,
            headers: corsHeaders({ "content-type": "application/json" }),
          });
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
              {
                status: 500,
                headers: corsHeaders({ "content-type": "application/json" }),
              },
            );
          }
        }
        if (req.method === "POST") {
          try {
            const body = await req.json().catch(() => ({}));
            const toolId = body.tool;
            const input = body.input || {};
            // Debug logging of incoming request (safe fields only)
            logSafe.info("[MCP] Incoming tool request", {
              tool: toolId,
              keys: Object.keys(input || {}),
            });
            const isLocal = (req.headers.get("host") || "").includes(
              "localhost",
            );
            if (isLocal && toolId === "MY_TOOL") {
              return new Response(
                JSON.stringify({
                  tool: "MY_TOOL",
                  input,
                  result: {
                    message: `Hello, ${(input as any).name || "world"}!`,
                  },
                }),
                {
                  status: 200,
                  headers: corsHeaders({ "content-type": "application/json" }),
                },
              );
            }
            // Unified fast-path for LINK_ANALYZER (both local and production) to avoid runtime context issues
            if (toolId === "LINK_ANALYZER") {
              try {
                if (!input.url) {
                  return new Response(
                    JSON.stringify({ error: "Missing url in input" }),
                    {
                      status: 400,
                      headers: corsHeaders({
                        "content-type": "application/json",
                      }),
                    },
                  );
                }
                const result = await analyzeLinks((input as any).url);
                const execMs = 0; // basic path already measured inside analyzeLinks if needed
                try { recordToolSuccess("LINK_ANALYZER", execMs); } catch {}
                return new Response(
                  JSON.stringify({ tool: "LINK_ANALYZER", input, result }),
                  {
                    status: 200,
                    headers: corsHeaders({
                      "content-type": "application/json",
                      "X-Source": isLocal ? "local-bypass" : "direct-exec",
                    }),
                  },
                );
              } catch (e) {
                logSafe.error("[MCP] LINK_ANALYZER direct exec error", {
                  error: (e as Error).message,
                });
                try { recordToolError("LINK_ANALYZER", 0); } catch {}
                return new Response(
                  JSON.stringify({ error: (e as Error).message }),
                  {
                    status: 500,
                    headers: corsHeaders({
                      "content-type": "application/json",
                    }),
                  },
                );
              }
            }
            if (!toolId) {
              logSafe.error("[MCP] Missing 'tool' field", { body });
              return new Response(
                JSON.stringify({ error: "Missing 'tool' field" }),
                {
                  status: 400,
                  headers: corsHeaders({ "content-type": "application/json" }),
                },
              );
            }
            const factories = [createMyTool, ...toolFactories];
            // Provide dummy environment variables in local dev to satisfy schema validation
            // Only if they are missing. These are placeholders; real values should be set in production via wrangler secrets/bindings.
            const devEnvKeys = [
              "CF_DISPATCH_NAMESPACE",
              "CF_ACCOUNT_ID",
              "CF_API_TOKEN",
              "SUPABASE_URL",
              "SUPABASE_SERVER_TOKEN",
              "TURSO_GROUP_DATABASE_TOKEN",
              "TURSO_ORGANIZATION",
              "OPENROUTER_API_KEY",
            ];
            // isLocal already computed above
            let toolEnv: any = env;
            if (isLocal) {
              toolEnv = { ...env };
              for (const k of devEnvKeys) {
                if (!(k in toolEnv) || toolEnv[k] === undefined) {
                  toolEnv[k] = `dev-${k.toLowerCase()}`;
                }
              }
            }
            const factory = factories.find((f) => {
              try {
                return (f as any)(toolEnv).id === toolId;
              } catch {
                return false;
              }
            });
            if (!factory) {
              logSafe.error(`[MCP] Tool '${toolId}' not found`, { body });
              return new Response(
                JSON.stringify({ error: `Tool '${toolId}' not found` }),
                {
                  status: 404,
                  headers: corsHeaders({ "content-type": "application/json" }),
                },
              );
            }
      const tool = (factory as any)(toolEnv);
      let execStart = Date.now();
      try {
              let execution: any;
              // Fast-path bypass for local dev to skip env-heavy validation for simple tools
              if (
                isLocal &&
                (toolId === "LINK_ANALYZER" || toolId === "MY_TOOL")
              ) {
                if (toolId === "MY_TOOL") {
                  execution = {
                    message: `Hello, ${(input as any).name || "world"}!`,
                  };
                } else if (toolId === "LINK_ANALYZER") {
                  try {
        const laStart = Date.now();
                    const { analyzeLinks } = await import(
                      "./tools/link-analyzer/analyze"
                    );
                    execution = await analyzeLinks((input as any).url);
        recordToolSuccess("LINK_ANALYZER", Date.now() - laStart);
                  } catch (e) {
                    logSafe.error("[MCP] Bypass analyze error", {
                      error: (e as Error).message,
                    });
                    throw e;
                  }
                }
              } else {
                execution = await tool.execute({ context: input });
              }
              const execMs = Date.now() - execStart;
              try {
                recordToolSuccess(tool.id, execMs);
              } catch {}
              logSafe.info("[MCP] Tool OK", { tool: tool.id, ms: execMs });
              const result = {
                ...execution,
                links: Array.isArray((execution as any).links)
                  ? (execution as any).links
                  : [],
              };
              return new Response(
                JSON.stringify({ tool: tool.id, input, result }),
                {
                  status: 200,
                  headers: corsHeaders({ "content-type": "application/json" }),
                },
              );
            } catch (toolErr) {
              try {
                const execMs = Date.now() - execStart;
                recordToolError(toolId, execMs);
              } catch {}
              const isZod =
                toolErr &&
                typeof toolErr === "object" &&
                (toolErr as any).name === "ZodError";
              const stack =
                toolErr && typeof toolErr === "object" && "stack" in toolErr
                  ? (toolErr as any).stack
                  : undefined;
              logSafe.error("[MCP] Tool execution error", {
                toolId,
                input,
                isZod,
                error: (toolErr as Error).message,
              });
              if (stack) logSafe.error("Stack trace", { stack });
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
              return new Response(JSON.stringify(payload), {
                status: statusCode,
                headers: corsHeaders({
                  "content-type": "application/json",
                  "X-Error-Type": isZod ? "ZodError" : "ToolError",
                }),
              });
            }
          } catch (err) {
            logSafe.error("[MCP] Handler error", {
              error: (err as Error).message,
            });
            return new Response(
              JSON.stringify({ error: (err as Error).message }),
              {
                status: 500,
                headers: corsHeaders({ "content-type": "application/json" }),
              },
            );
          }
        }
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: corsHeaders({ "content-type": "application/json" }),
        });
      })();
    }
    return (baseRuntime as any).fetch(req, env, ctx);
  },
};

export default runtime;
