import { describe, it, expect } from "bun:test";
import { ViewRegistry } from "../render/view-registry.js";

describe("Dynamic View Loading", () => {
    it("should load views from MCP server", async () => {
        // Mock MCP client that returns views
        const mockClient = {
            async callTool(name: string, args: any) {
                if (name === "LIST_VIEWS") {
                    return {
                        views: [
                            {
                                key: "test-view",
                                contentType: "test",
                                code: "return `<div>Hello ${data.name}</div>`;"
                            },
                            {
                                key: "post-card",
                                contentType: "post",
                                code: "return `<article><h3>${data.title}</h3><p>${data.body}</p></article>`;"
                            }
                        ]
                    };
                }
                throw new Error(`Unknown tool: ${name}`);
            }
        };

        const registry = new ViewRegistry<string>();
        await registry.loadViewsFromMcp(mockClient);

        // Verify views were registered
        const testView = registry.get("test-view");
        expect(testView).toBeDefined();

        const postView = registry.get("post-card");
        expect(postView).toBeDefined();

        // Test rendering
        const result = await testView!({
            data: { name: "World" },
            block: { id: "test", contentType: "test" }
        });
        expect(result).toBe("<div>Hello World</div>");

        const postResult = await postView!({
            data: { title: "Test Post", body: "Test content" },
            block: { id: "post-1", contentType: "post" }
        });
        expect(postResult).toContain("Test Post");
        expect(postResult).toContain("Test content");
    });

    it("should handle views with complex logic", async () => {
        const mockClient = {
            async callTool(name: string, args: any) {
                return {
                    views: [
                        {
                            key: "post-list",
                            contentType: "post-list",
                            code: `
                                const posts = data.posts || [];
                                const items = posts.map(p => \`<article><h3>\${p.title}</h3></article>\`).join('');
                                return \`<div class="posts">\${items}</div>\`;
                            `
                        }
                    ]
                };
            }
        };

        const registry = new ViewRegistry<string>();
        await registry.loadViewsFromMcp(mockClient);

        const view = registry.get("post-list");
        const result = await view!({
            data: {
                posts: [
                    { title: "Post 1" },
                    { title: "Post 2" }
                ]
            },
            block: { id: "list", contentType: "post-list" }
        });

        expect(result).toContain("Post 1");
        expect(result).toContain("Post 2");
        expect(result).toContain('class="posts"');
    });

    it("should handle empty views gracefully", async () => {
        const mockClient = {
            async callTool(name: string, args: any) {
                return { views: [] };
            }
        };

        const registry = new ViewRegistry<string>();
        await registry.loadViewsFromMcp(mockClient);

        // Should not throw, just have no views
        expect(registry.get("any-key")).toBeUndefined();
    });

    it("should handle malformed view code gracefully", async () => {
        const mockClient = {
            async callTool(name: string, args: any) {
                return {
                    views: [
                        {
                            key: "broken-view",
                            code: "this is not valid javascript {{"
                        },
                        {
                            key: "good-view",
                            code: "return 'works';"
                        }
                    ]
                };
            }
        };

        const registry = new ViewRegistry<string>();
        await registry.loadViewsFromMcp(mockClient);

        // Broken view should not be registered
        expect(registry.get("broken-view")).toBeUndefined();

        // Good view should still work
        expect(registry.get("good-view")).toBeDefined();
    });
});
