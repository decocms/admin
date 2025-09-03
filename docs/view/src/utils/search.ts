import { getCollection } from "astro:content";

export interface SearchResult {
  title: string;
  content: string;
  url: string;
  section: string;
  excerpt: string;
}

// Simple text search function
function searchInText(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

// Extract relevant excerpt from content
function extractExcerpt(content: string, query: string, maxLength = 150): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryIndex = lowerContent.indexOf(lowerQuery);
  
  if (queryIndex === -1) {
    // If query not found, return beginning of content
    return content.slice(0, maxLength) + (content.length > maxLength ? "..." : "");
  }
  
  // Extract context around the query
  const start = Math.max(0, queryIndex - 50);
  const end = Math.min(content.length, queryIndex + query.length + 100);
  const excerpt = content.slice(start, end);
  
  return (start > 0 ? "..." : "") + excerpt + (end < content.length ? "..." : "");
}

// Get section name from file path
function getSectionFromPath(id: string): string {
  const parts = id.split("/");
  if (parts.length > 2) {
    // e.g., "en/guides/getting-started" -> "Guides"
    const section = parts[1];
    return section.charAt(0).toUpperCase() + section.slice(1);
  }
  return "Documentation";
}

export async function searchDocumentation(query: string, locale: string = "en"): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    // Get all documentation content
    const allDocs = await getCollection("docs");
    const docs = allDocs.filter((doc) => doc.id.split("/")[0] === locale);
    
    const results: SearchResult[] = [];
    
    for (const doc of docs) {
      const { data, body } = doc;
      const title = data.title || "";
      const description = data.description || "";
      const content = body || "";
      
      // Search in title, description, and content
      const titleMatch = searchInText(title, query);
      const descriptionMatch = searchInText(description, query);
      const contentMatch = searchInText(content, query);
      
      if (titleMatch || descriptionMatch || contentMatch) {
        // Calculate relevance score
        let score = 0;
        if (titleMatch) score += 10;
        if (descriptionMatch) score += 5;
        if (contentMatch) score += 1;
        
        // Create URL from document ID
        const urlPath = doc.id.split("/").slice(1).join("/");
        const url = `/${locale}/${urlPath}`;
        
        // Extract relevant excerpt
        const searchText = contentMatch ? content : (descriptionMatch ? description : title);
        const excerpt = extractExcerpt(searchText, query);
        
        results.push({
          title,
          content: description || excerpt,
          url,
          section: getSectionFromPath(doc.id),
          excerpt,
        });
      }
    }
    
    // Sort by relevance (title matches first, then description, then content)
    results.sort((a, b) => {
      const aScore = searchInText(a.title, query) ? 10 : (searchInText(a.content, query) ? 5 : 1);
      const bScore = searchInText(b.title, query) ? 10 : (searchInText(b.content, query) ? 5 : 1);
      return bScore - aScore;
    });
    
    // Limit results
    return results.slice(0, 8);
    
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

// Search suggestions based on popular queries
export function getSearchSuggestions(query: string): string[] {
  const suggestions = [
    "getting started",
    "installation", 
    "configuration",
    "CLI commands",
    "project structure",
    "deployment",
    "troubleshooting",
    "integrations",
    "workflows",
    "tools",
  ];
  
  if (!query) return suggestions.slice(0, 5);
  
  const filtered = suggestions.filter(s => 
    s.toLowerCase().includes(query.toLowerCase())
  );
  
  return filtered.slice(0, 5);
}
