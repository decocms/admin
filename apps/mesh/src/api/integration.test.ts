/**
 * MCP Integration Tests
 * 
 * Tests the MCP protocol integration using the MCP Client SDK
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import app from './index';

describe('MCP Integration', () => {
  describe('Management Tools MCP Server', () => {
    let client: Client | null = null;

    afterEach(async () => {
      if (client) {
        await client.close();
        client = null;
      }
    });

    it('should list all management tools via MCP protocol', async () => {
      // Create custom fetch adapter that routes through Hono app
      const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        // Extract the path from the URL
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const urlObj = new URL(url);
        const path = urlObj.pathname;

        // Route request through Hono app
        const response = await app.request(path, {
          method: init?.method || 'POST',
          headers: init?.headers as Record<string, string>,
          body: init?.body,
        });

        return response;
      };

      // Create transport with custom fetch in requestInit
      const transport = new StreamableHTTPClientTransport(
        new URL('http://localhost:3000/mcp'),
        {
          requestInit: {
            // @ts-expect-error - custom fetch type mismatch
            fetch: customFetch,
          },
        }
      );

      // Create MCP client
      client = new Client({
        name: 'test-client',
        version: '1.0.0',
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
        'PROJECT_CREATE',
        'PROJECT_LIST',
        'PROJECT_GET',
        'PROJECT_UPDATE',
        'PROJECT_DELETE',
        'CONNECTION_CREATE',
        'CONNECTION_LIST',
        'CONNECTION_GET',
        'CONNECTION_DELETE',
        'CONNECTION_TEST',
      ];

      expect(result.tools.length).toBe(expectedTools.length);

      const toolNames = result.tools.map((tool) => tool.name);
      for (const expectedTool of expectedTools) {
        expect(toolNames).toContain(expectedTool);
      }

      // Verify each tool has required properties
      for (const tool of result.tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });
  });
});

