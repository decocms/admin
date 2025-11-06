/**
 * MCP Integration Tests
 *
 * Tests the MCP protocol integration using the MCP Client SDK
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { RequestInfo } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../auth";
import app from "./index";

describe("MCP Integration", () => {
  describe("Management Tools MCP Server", () => {
    let client: Client | null = null;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      // Store original fetch
      originalFetch = global.fetch;

      // Mock auth.api.getMcpSession to return null (will fall back to API key)
      vi.spyOn(auth.api, "getMcpSession").mockResolvedValue(null);

      // Mock auth.api.verifyApiKey to return valid result
      vi.spyOn(auth.api, "verifyApiKey").mockResolvedValue({
        valid: true,
        error: null,
        key: {
          id: "test-key-id",
          name: "Test API Key",
          userId: "test-user-id",
          permissions: {
            self: [
              "ORGANIZATION_CREATE",
              "ORGANIZATION_LIST",
              "ORGANIZATION_GET",
              "ORGANIZATION_UPDATE",
              "ORGANIZATION_DELETE",
              "CONNECTION_CREATE",
              "CONNECTION_LIST",
              "CONNECTION_GET",
              "CONNECTION_DELETE",
              "CONNECTION_TEST",
            ],
          },
          metadata: {
            organization: {
              id: "org_123",
              slug: "test-org",
              name: "Test Organization",
            },
          },
        },
        // oxlint-disable-next-line no-explicit-any
      } as any);

      // Mock global fetch to route through Hono app
      global.fetch = vi.fn(
        async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ): Promise<Response> => {
          // Create a proper Request object
          const request = new Request(input as string | URL, init);

          // Route request through Hono app using fetch (not request)
          const response = await app.fetch(request);

          return response;
        },
      ) as unknown as typeof global.fetch;
    });

    afterEach(async () => {
      // Restore original fetch
      global.fetch = originalFetch;

      // Restore all mocks
      vi.restoreAllMocks();

      if (client) {
        await client.close();
        client = null;
      }
    });

    it.skip("should list all management tools via MCP protocol", async () => {
      // TODO: Fix integration test - requires complex Better Auth mocking
      // Create transport with Authorization header - will use mocked global fetch
      const transport = new StreamableHTTPClientTransport(
        new URL("http://localhost:3000/mcp"),
      );

      // Create MCP client
      client = new Client({
        name: "test-client",
        version: "1.0.0",
      });

      // Connect client to transport
      await client.connect(transport);

      // List tools using MCP protocol
      const result = await client.listTools();

      // Verify response structure
      expect(result).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);

      // Verify all 10 expected tools are present
      const expectedTools = [
        "ORGANIZATION_CREATE",
        "ORGANIZATION_LIST",
        "ORGANIZATION_GET",
        "ORGANIZATION_UPDATE",
        "ORGANIZATION_DELETE",
        "CONNECTION_CREATE",
        "CONNECTION_LIST",
        "CONNECTION_GET",
        "CONNECTION_DELETE",
        "CONNECTION_TEST",
      ];

      expect(result.tools.length).toBe(expectedTools.length);

      const toolNames = result.tools.map((tool) => tool.name);
      for (const expectedTool of expectedTools) {
        expect(toolNames).toContain(expectedTool);
      }

      // Verify each tool has required properties
      for (const tool of result.tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe("string");
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it.skip("should call a management tool via MCP protocol", async () => {
      // TODO: Fix integration test - requires complex Better Auth mocking
      // Create transport with Authorization header
      const transport = new StreamableHTTPClientTransport(
        new URL("http://localhost:3000/mcp"),
      );

      // Create MCP client
      client = new Client({
        name: "test-client",
        version: "1.0.0",
      });

      // Connect client to transport
      await client.connect(transport);

      // Call ORGANIZATION_LIST tool
      const result = await client
        .callTool({
          name: "ORGANIZATION_LIST",
          arguments: {},
        })
        .catch((err) => {
          console.error("Error calling tool:", err);
          throw err;
        });

      // Verify response structure
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });
  });
});
