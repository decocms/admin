// Runtime endpoint for MCP tools proxied via the view worker.
// Accepts POST { tool: string, input: any }
// Currently implements LINK_ANALYZER by proxying to upstream (same origin /api/analisar) or returning stub.
import type { APIRoute } from "astro";

interface ToolRequest {
  tool?: string;
  input?: any;
}

export const prerender = false; // dynamic

export const POST: APIRoute = async ({ request }) => {
  try {
    if (request.method !== "POST")
      return new Response("Method Not Allowed", { status: 405 });
    const body: ToolRequest = await request.json().catch(() => ({}));
    if (!body.tool) return json({ error: "tool ausente" }, 400);
    if (body.tool !== "LINK_ANALYZER")
      return json({ error: "tool desconhecida" }, 400);
    const url = body.input?.url?.toString() || "";
    if (!url || !/^https?:\/\//i.test(url))
      return json({ error: "URL inválida" }, 422);

    // Try proxy to upstream worker path (root worker implements logic). If fails, fallback stub.
    try {
      const upstream = new URL("/api/analisar", request.url);
      const proxyRes = await fetch(upstream, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json().catch(() => null);
        if (data) return json({ tool: "LINK_ANALYZER", result: data });
      }
      // If not ok, continue to stub
    } catch (_e) {
      /* ignore and stub */
    }

    // Stub fallback
    const stub = buildStub(url);
    return json({ tool: "LINK_ANALYZER", result: stub, stub: true });
  } catch (e: any) {
    return json({ error: e?.message || "erro interno" }, 500);
  }
};

function buildStub(target: string) {
  const hostname = safeHost(target);
  return {
    title: `Preview (stub) de ${hostname}`,
    description:
      "Stub local: upstream indisponível. Conteúdo limitado para demonstração.",
    links: sampleLinks(hostname),
    fetchedAt: new Date().toISOString(),
  };
}

function sampleLinks(host: string) {
  return [
    `https://${host}/`,
    `https://${host}/sobre`,
    `https://${host}/contato`,
    `https://${host}/blog/post-exemplo`,
  ];
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname;
  } catch {
    return "host-desconhecido";
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
