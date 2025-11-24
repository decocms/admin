/**
 * Normalizes input object to a stable JSON string representation.
 * Keys are sorted alphabetically.
 */
export function normalizeInput(input: any): string {
    if (input === null || typeof input !== 'object') {
        return String(input);
    }

    if (Array.isArray(input)) {
        return JSON.stringify(input.map(normalizeInput));
    }

    const sortedKeys = Object.keys(input).sort();
    const sortedObj: Record<string, any> = {};

    for (const key of sortedKeys) {
        sortedObj[key] = input[key];
    }

    return JSON.stringify(sortedObj);
}

/**
 * Generates a canonical URL for a tool call.
 * 
 * Format: /mcp/TOOL_NAME?<normalized_params>&v=<version>
 * 
 * @param baseUrl Base URL of the MCP server (e.g., http://localhost:3000/mcp)
 * @param toolName Name of the tool
 * @param input Tool input arguments
 * @param version Optional version key for cache busting
 */
export function generateCanonicalUrl(
    baseUrl: string,
    toolName: string,
    input: Record<string, any>,
    version?: string
): string {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/${toolName}`);

    // Flatten input into query params
    // For complex objects, we might need to JSON stringify values or use a specific convention.
    // The prompt suggests: /mcp/TOOL_NAME?<stableNormalizedInput>&v=<cacheBustKey>
    // But also shows examples like: /mcp/SEARCH_POSTS?lang=en&limit=20
    // So we should try to map top-level keys to query params if they are primitives.
    // If they are objects, we might need to stringify them.

    const sortedKeys = Object.keys(input).sort();

    for (const key of sortedKeys) {
        const value = input[key];
        if (value === undefined || value === null) continue;

        if (typeof value === 'object') {
            url.searchParams.set(key, JSON.stringify(value));
        } else {
            url.searchParams.set(key, String(value));
        }
    }

    if (version) {
        url.searchParams.set('v', version);
    }

    return url.toString();
}
