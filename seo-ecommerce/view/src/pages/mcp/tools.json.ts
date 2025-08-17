export const prerender = true;

// Static placeholder listing instructing to use server runtime /mcp/tools instead.
export async function GET() {
  return new Response(
    JSON.stringify({
      message:
        "Use the deployed worker /mcp/tools endpoint for dynamic tool execution. This static file avoids SSR adapter needs.",
      tools: [
        {
          name: "LINK_ANALYZER",
          description:
            "Analisa link e retorna metadados (proxy/stub via worker).",
        },
      ],
      _static: true,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600",
      },
    },
  );
}
