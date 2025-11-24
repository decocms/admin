import { describe, it, expect } from "bun:test";
import { renderPath, ViewRegistry } from "../index.js";

// Mock MCP Client
class MockMcpClient {
    async callTool(name: string, args: any): Promise<any> {
        if (name === "GET_PAGE_CONTENT_FOR_PATH") {
            return {
                page: {
                    title: "Test Page",
                    path: args.path,
                    blocks: [
                        {
                            id: "header-1",
                            contentType: "header",
                            input: {
                                title: "Welcome",
                                links: [
                                    { label: "Home", href: "/" },
                                    { label: "About", href: "/about" }
                                ]
                            }
                        },
                        {
                            id: "post-list-1",
                            contentType: "post-list",
                            input: {
                                posts: [
                                    { title: "First Post", body: "This is the first post" },
                                    { title: "Second Post", body: "This is the second post" }
                                ]
                            }
                        },
                        {
                            id: "html-1",
                            contentType: "html",
                            input: {
                                html: "<div class='hero'><h2>Hero Section</h2></div>"
                            }
                        },
                        {
                            id: "footer-1",
                            contentType: "footer",
                            input: {
                                copyright: "© 2024 Test Site",
                                links: [
                                    { label: "Privacy", href: "/privacy" },
                                    { label: "Terms", href: "/terms" }
                                ]
                            }
                        }
                    ]
                }
            };
        }

        if (name === "GET_CONTENT") {
            // Mock dynamic content fetching
            return {
                title: "Dynamic Content",
                body: "This was fetched dynamically"
            };
        }

        throw new Error(`Unknown tool: ${name}`);
    }
}

describe("Render Path with Mock Data", () => {
    it("should render a page with header, posts, html, and footer", async () => {
        const client = new MockMcpClient();
        const registry = new ViewRegistry<string>();

        // Register views
        registry.register("header", ({ data }) => {
            const nav = data.links?.map((l: any) => `<a href="${l.href}">${l.label}</a>`).join(" | ") || "";
            return `<header><h1>${data.title}</h1><nav>${nav}</nav></header>`;
        });

        registry.register("post-list", ({ data }) => {
            const items = data.posts?.map((p: any) =>
                `<article><h3>${p.title}</h3><p>${p.body}</p></article>`
            ).join("") || "";
            return `<div class="posts">${items}</div>`;
        });

        registry.register("html", ({ data }) => {
            return data.html || "";
        });

        registry.register("footer", ({ data }) => {
            const links = data.links?.map((l: any) => `<a href="${l.href}">${l.label}</a>`).join(" | ") || "";
            return `<footer><p>${data.copyright}</p><nav>${links}</nav></footer>`;
        });

        // Render
        const result = await renderPath({
            client,
            registry,
            path: "/",
            renderPage: (page, blocks) => {
                return `<!DOCTYPE html><html><head><title>${page.title}</title></head><body>${blocks.join("")}</body></html>`;
            }
        });

        // Assertions
        expect(result).toBeDefined();
        expect(result).toContain("<h1>Welcome</h1>");
        expect(result).toContain("<a href=\"/\">Home</a>");
        expect(result).toContain("<a href=\"/about\">About</a>");
        expect(result).toContain("<h3>First Post</h3>");
        expect(result).toContain("<p>This is the first post</p>");
        expect(result).toContain("<h3>Second Post</h3>");
        expect(result).toContain("<div class='hero'><h2>Hero Section</h2></div>");
        expect(result).toContain("© 2024 Test Site");
        expect(result).toContain("<a href=\"/privacy\">Privacy</a>");
    });

    it("should handle dynamic blocks", async () => {
        const client = new MockMcpClient();
        const registry = new ViewRegistry<string>();

        registry.register("dynamic-content", ({ data }) => {
            return `<div><h2>${data.title}</h2><p>${data.body}</p></div>`;
        });

        // Mock a page with a dynamic block
        const mockClient = {
            async callTool(name: string, args: any) {
                if (name === "GET_PAGE_CONTENT_FOR_PATH") {
                    return {
                        page: {
                            title: "Dynamic Page",
                            path: "/",
                            blocks: [
                                {
                                    id: "dynamic-1",
                                    contentType: "dynamic-content",
                                    inputType: "dynamic",
                                    input: {
                                        tool: "GET_CONTENT",
                                        args: { id: "dynamic-1" }
                                    }
                                }
                            ]
                        }
                    };
                }
                if (name === "GET_CONTENT") {
                    return {
                        title: "Dynamic Content",
                        body: "This was fetched dynamically"
                    };
                }
                throw new Error(`Unknown tool: ${name}`);
            }
        };

        const result = await renderPath({
            client: mockClient,
            registry,
            path: "/",
            renderPage: (page, blocks) => blocks.join("")
        });

        expect(result).toContain("Dynamic Content");
        expect(result).toContain("This was fetched dynamically");
    });

    it("should handle missing views gracefully", async () => {
        const client = new MockMcpClient();
        const registry = new ViewRegistry<string>();

        // Only register header view, not others
        registry.register("header", ({ data }) => `<header>${data.title}</header>`);

        const result = await renderPath({
            client,
            registry,
            path: "/",
            renderPage: (page, blocks) => blocks.join("")
        });

        // Should render header but skip others
        expect(result).toContain("<header>Welcome</header>");
        // Should not crash even though other views are missing
        expect(result).toBeDefined();
    });

    it("should return null for non-existent pages", async () => {
        const mockClient = {
            async callTool(name: string, args: any) {
                return { page: null };
            }
        };

        const registry = new ViewRegistry<string>();

        const result = await renderPath({
            client: mockClient,
            registry,
            path: "/non-existent"
        });

        expect(result).toBeNull();
    });
});
