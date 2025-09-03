import type { APIRoute } from "astro";
import { searchDocumentation } from "../../utils/search";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const locale = url.searchParams.get("locale") || "en";
  
  if (!query) {
    return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  
  try {
    const results = await searchDocumentation(query, locale);
    
    return new Response(JSON.stringify({ results, query }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error("Search API error:", error);
    
    return new Response(JSON.stringify({ error: "Search failed" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
