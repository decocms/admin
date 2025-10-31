/**
 * MCP Integration Tests
 * 
 * Tests the MCP protocol integration using the MCP Client SDK
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { RequestInfo } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '../auth';
import app from './index';

describe('MCP Integration', () => {
  describe('Management Tools MCP Server', () => {
    let client: Client | null = null;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      // Store original fetch
      originalFetch = global.fetch;

      // Mock auth.api.verifyApiKey to return valid result
      vi.spyOn(auth.api, 'verifyApiKey').mockResolvedValue({
        valid: true,
        key: {
          id: 'test-key-id',
          name: 'Test API Key',
          userId: 'test-user-id',
          permissions: {
            self: ['PROJECT_CREATE', 'PROJECT_LIST', 'PROJECT_GET', 'PROJECT_UPDATE', 'PROJECT_DELETE',
              'CONNECTION_CREATE', 'CONNECTION_LIST', 'CONNECTION_GET', 'CONNECTION_DELETE', 'CONNECTION_TEST'],
          },
        },
      } as any);

      // Mock global fetch to route through Hono app
      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        // Extract the path from the URL
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as unknown as Request).url;
        const urlObj = new URL(url);
        const path = urlObj.pathname;

        // Route request through Hono app
        const response = await app.request(path, {
          method: init?.method || 'POST',
          headers: init?.headers as Record<string, string>,
          body: init?.body,
        });

        return response;
      }) as typeof global.fetch;
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

    it('should list all management tools via MCP protocol', async () => {
      // Create transport with Authorization header - will use mocked global fetch
      const transport = new StreamableHTTPClientTransport(
        new URL('http://localhost:3000/mcp'),
      );

      // Create MCP client
      client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });


      // Connect client to transport
      await client.connect(transport);

      // List tools using MCP protocol
      const result = await client.listTools().catch(err => {
        console.error(err);
        throw err;
      });
      console.log({ result });

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

    it('should call a management tool via MCP protocol', async () => {
      // Create transport
      const transport = new StreamableHTTPClientTransport(
        new URL('http://localhost:3000/mcp'),
      );

      // Create MCP client
      client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });

      // Connect client to transport
      await client.connect(transport);

      // Call PROJECT_LIST tool
      const result = await client.callTool({
        name: 'PROJECT_LIST',
        arguments: {},
      }).catch(err => {
        console.error('Error calling tool:', err);
        throw err;
      });

      console.log({ callResult: result });

      // Verify response structure
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });
  });
});

