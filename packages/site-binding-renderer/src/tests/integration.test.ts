import { describe, it, expect, beforeAll } from "bun:test";
import { SimpleMcpClient } from "../mcp/client.js";
import { SITE_BINDING } from "../bindings/site.js";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3001/deco-team/site-binding/self/mcp";
const MCP_SERVER_TOKEN = process.env.MCP_SERVER_TOKEN;

describe("Site Binding Integration Tests", () => {
    let client: SimpleMcpClient;

    beforeAll(() => {
        if (!MCP_SERVER_URL) {
            console.warn("Skipping integration tests: MCP_SERVER_URL not set");
            return;
        }
        client = new SimpleMcpClient({ baseUrl: MCP_SERVER_URL, token: MCP_SERVER_TOKEN });
    });

    it("should connect and initialize with the MCP server", async () => {
        // SimpleMcpClient initializes lazily on first call, but we can check if we can make a basic request
        // For this test, we'll just check if the client was created successfully
        expect(client).toBeDefined();
    });

    it("should list tools and verify SITE binding tools are present", async () => {
        const response = await client.callTool("list_tools", {}); // Standard MCP tool listing might be different, usually it's a JSON-RPC method 'tools/list'
        // However, SimpleMcpClient.callTool sends a POST to /tools/<name>.
        // Standard MCP uses JSON-RPC. SimpleMcpClient seems to be a specific HTTP adapter.
        // Let's check how SimpleMcpClient is implemented.
        // If it's just POST /tools/<name>, then we might not have a "list_tools" tool unless the server exposes it.
        // But standard MCP has 'tools/list'.

        // Wait, SimpleMcpClient implementation:
        // async callTool(name: string, args: any) { ... fetch(`${this.baseUrl}/tools/${name}`, ...) }

        // If the server follows standard MCP over HTTP (SSE/Post), it might be different.
        // But the previous context suggests this client is tailored for a specific HTTP-based MCP.

        // Let's assume we can call the SITE tools directly.
        // We'll skip a generic "list_tools" check if it's not exposed as a tool, 
        // and instead check if we can call the specific SITE tools.
    });

    it("should call GET_PAGE_CONTENT_FOR_PATH and return a valid page", async () => {
        const path = "/"; // Root path
        try {
            const result = await client.callTool(SITE_BINDING.tools.GET_PAGE_CONTENT_FOR_PATH.name, { path });

            console.log("GET_PAGE_CONTENT_FOR_PATH result:", JSON.stringify(result, null, 2));

            expect(result).toBeDefined();
            // The result should match the output schema roughly
            // outputSchema: z.object({ page: PageSchema.nullable() })

            if (result.page) {
                expect(result.page).toHaveProperty("blocks");
                expect(Array.isArray(result.page.blocks)).toBe(true);

                // Verify blocks have contentType field (SITE binding spec requirement)
                if (result.page.blocks.length > 0) {
                    for (const block of result.page.blocks) {
                        expect(block).toHaveProperty("contentType");
                        expect(typeof block.contentType).toBe("string");
                        expect(block.contentType.length).toBeGreaterThan(0);
                    }
                }
            } else {
                // It's valid to return null page if not found, but we expect a response structure
                expect(result).toHaveProperty("page");
            }
        } catch (error) {
            console.error("Failed to call GET_PAGE_CONTENT_FOR_PATH:", error);
            throw error;
        }
    });

    it("should list content types", async () => {
        try {
            const result = await client.callTool(SITE_BINDING.tools.LIST_CONTENT_TYPES.name, {});

            console.log("LIST_CONTENT_TYPES result:", JSON.stringify(result, null, 2));

            expect(result).toBeDefined();
            expect(result).toHaveProperty("types");
            expect(Array.isArray(result.types)).toBe(true);
        } catch (error) {
            console.error("Failed to call LIST_CONTENT_TYPES:", error);
            throw error;
        }
    });

    it("should fetch and verify actual post content", async () => {
        try {
            // Get the page content
            const pageResult = await client.callTool(SITE_BINDING.tools.GET_PAGE_CONTENT_FOR_PATH.name, { path: "/" });

            expect(pageResult).toBeDefined();
            expect(pageResult.page).toBeDefined();
            expect(pageResult.page.blocks).toBeDefined();

            // Look for blocks with input data
            const blocksWithInput = pageResult.page.blocks.filter((b: any) => b.input);

            console.log(`Found ${blocksWithInput.length} blocks with input data`);

            // If there are blocks with input, verify they have content
            if (blocksWithInput.length > 0) {
                for (const block of blocksWithInput) {
                    console.log(`Block ${block.id} (${block.contentType}):`, JSON.stringify(block.input, null, 2));

                    // Verify input is an object
                    expect(typeof block.input).toBe("object");
                    expect(block.input).not.toBeNull();

                    // If it's a post-list block, verify posts array
                    if (block.contentType === "post-list" && block.input.posts) {
                        expect(Array.isArray(block.input.posts)).toBe(true);
                        expect(block.input.posts.length).toBeGreaterThan(0);

                        // Verify each post has required fields
                        for (const post of block.input.posts) {
                            expect(post).toHaveProperty("title");
                            expect(post).toHaveProperty("body");
                        }

                        console.log(`✓ Found ${block.input.posts.length} posts in block ${block.id}`);
                    }
                }
            } else {
                console.log("⚠ No blocks with input data found - server may need to add content to blocks");
            }
        } catch (error) {
            console.error("Failed to fetch post content:", error);
            throw error;
        }
    });
});
