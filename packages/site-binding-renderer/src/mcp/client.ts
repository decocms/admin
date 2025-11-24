import { SiteMcpClient } from '../render/core.js';
import { generateCanonicalUrl } from './cache.js';
import { SITE_BINDING } from '../bindings/site.js';

export interface SiteClientConfig {
    baseUrl: string;
    token?: string;
}

export class SimpleMcpClient implements SiteMcpClient {
    constructor(private config: SiteClientConfig) { }

    async callTool(name: string, args: any): Promise<any> {
        // Check if tool is cacheable in SITE binding
        // In a real implementation, we might need a more dynamic way to check this if tools are discovered at runtime.
        // For now, we check against the known binding definition.
        const toolDef = Object.values(SITE_BINDING.tools).find(t => t.name === name);
        // TODO: Re-enable this when the server supports the cacheable GET endpoints
        const isCacheable = false; // toolDef && 'cache' in toolDef && toolDef.cache?.public;

        let url: string;
        let method: string;
        let body: string | undefined;

        if (isCacheable) {
            // Use GET with canonical URL
            // We assume the server supports GET /mcp/TOOL_NAME?params...
            // The generateCanonicalUrl helper assumes the base URL is the root of the MCP tools endpoint.
            // If config.baseUrl is "http://localhost:3000/mcp", then generateCanonicalUrl will produce
            // "http://localhost:3000/mcp/TOOL_NAME?..."

            // We might need to extract a version key from args if present, but for now we'll pass undefined
            // or let the caller handle versioning in args.
            // The prompt says: "Tools return or accept a version key (v)".
            // If it's in args, generateCanonicalUrl handles it if we pass it.
            // But generateCanonicalUrl treats 'v' specially.
            // Let's assume 'v' might be in args.

            const { v, ...restArgs } = args;
            url = generateCanonicalUrl(this.config.baseUrl, name, restArgs, v);
            method = 'GET';
        } else {
            // Fallback to JSON-RPC via POST
            url = this.config.baseUrl; // Standard MCP endpoint
            method = 'POST';
            body = JSON.stringify({
                jsonrpc: "2.0",
                id: crypto.randomUUID(),
                method: "tools/call",
                params: {
                    name: name,
                    arguments: args
                }
            });
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
        };

        // Support both Bearer token and Cookie-based authentication
        if (this.config.token) {
            // If token looks like a cookie string (contains '='), use it as Cookie header
            if (this.config.token.includes('=')) {
                headers['Cookie'] = this.config.token;
            } else {
                headers['Authorization'] = `Bearer ${this.config.token}`;
            }
        }

        console.log(`Calling tool ${name} at ${url} with method ${method}`);
        const response = await fetch(url, {
            method,
            headers,
            body,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`MCP Tool Call Failed: ${response.status} ${response.statusText} - ${text}`);
        }

        const contentType = response.headers.get('content-type');

        // Handle SSE (Server-Sent Events) response
        if (contentType?.includes('text/event-stream')) {
            const text = await response.text();
            // Parse SSE format: "data: {...}\n\n"
            const lines = text.split('\n').filter(line => line.startsWith('data: '));
            if (lines.length === 0) {
                throw new Error('No data in SSE response');
            }
            // Get the last data line (final result)
            const lastDataLine = lines[lines.length - 1];
            const jsonStr = lastDataLine.substring(6); // Remove "data: " prefix
            const data = JSON.parse(jsonStr);

            // Handle JSON-RPC response
            if (method === 'POST') {
                if (data.error) {
                    throw new Error(`MCP JSON-RPC Error: ${data.error.message}`);
                }
                // MCP tools/call returns result with content array OR direct result
                if (data.result?.content?.[0]?.text) {
                    console.log('Parsing MCP result content...');
                    try {
                        const parsed = JSON.parse(data.result.content[0].text);
                        console.log('Parsed:', JSON.stringify(parsed).substring(0, 100));
                        // Unwrap { isError, structuredContent } if present
                        if (parsed.structuredContent && typeof parsed.isError === 'boolean') {
                            console.log('Unwrapping structuredContent');
                            return parsed.structuredContent;
                        }
                        console.log('Returning parsed directly (no unwrap needed)');
                        return parsed;
                    } catch {
                        return data.result.content[0].text;
                    }
                }

                // Handle direct result (not in content array)
                if (data.result) {
                    console.log('Handling direct result');
                    // Unwrap { isError, structuredContent } if present
                    if (data.result.structuredContent && typeof data.result.isError === 'boolean') {
                        console.log('Unwrapping structuredContent from direct result');
                        return data.result.structuredContent;
                    }
                    return data.result;
                }

                console.log('Returning data');
                return data;
            }

            return data;
        }

        // Handle regular JSON response
        const data = await response.json();

        // Handle JSON-RPC response
        if (method === 'POST') {
            if (data.error) {
                throw new Error(`MCP JSON-RPC Error: ${data.error.message}`);
            }
            // MCP tools/call returns result with content array
            if (data.result?.content?.[0]?.text) {
                try {
                    const parsed = JSON.parse(data.result.content[0].text);
                    // Unwrap { isError, structuredContent } if present
                    if (parsed.structuredContent && typeof parsed.isError === 'boolean') {
                        return parsed.structuredContent;
                    }
                    return parsed;
                } catch {
                    return data.result.content[0].text;
                }
            }
            return data.result || data;
        }

        return data;
    }
}

export function createSiteClient(config: SiteClientConfig): SiteMcpClient {
    return new SimpleMcpClient(config);
}
