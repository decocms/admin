import type { APIRoute } from "astro";
import { analyzeLinks } from "../../../../server/tools/link-analyzer/analyze";

export const POST: APIRoute = async ({ request }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const url = body?.url || body?.input?.url;
  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "url requerida" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
  try {
    const result = await analyzeLinks(url);
    return new Response(JSON.stringify({ url, result, local: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "falha" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
};

export const OPTIONS: APIRoute = async () =>
  new Response("", {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
