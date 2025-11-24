import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createSiteClient, renderPath, ViewRegistry } from '../../src/index.js';
import { HeaderView, PostListView, FooterView } from './views/index.js';

const app = new Hono();

// --- Configuration ---
const MCP_URL = process.env.MCP_URL || 'http://localhost:3001/deco-team/site-binding/self/mcp';
const MCP_TOKEN = process.env.MCP_SERVER_TOKEN;
const PORT = Number(process.env.PORT) || 8080;

// --- Setup ---
const client = createSiteClient({
  baseUrl: MCP_URL,
  token: MCP_TOKEN
});
const registry = new ViewRegistry<string>();

// Try to load views from MCP server first
try {
  await registry.loadViewsFromMcp(client);
  console.log('✓ Loaded views from MCP server');
} catch (error) {
  console.warn('Failed to load views from MCP, using fallback views:', error);

  // Fallback to hardcoded views
  registry.register('header', HeaderView);
  registry.register('footer', FooterView);
  registry.register('html', PostListView);
  registry.register('post-list', PostListView);
}

// --- Routes ---

app.get('*', async (c) => {
  const path = c.req.path;

  try {
    const renderedBlocks = await renderPath({
      client,
      registry,
      path,
      renderPage: (page, blocks) => {
        return `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${page.title || 'SSR Demo'}</title>
              <style>body { font-family: sans-serif; margin: 0; }</style>
            </head>
            <body>
              ${blocks.join('')}
            </body>
          </html>
        `;
      }
    });

    if (renderedBlocks === null) {
      return c.html('<h1>404 - Page Not Found</h1>', 404);
    }

    return c.html(renderedBlocks);
  } catch (err: any) {
    console.error(err);
    return c.html(`<h1>Error</h1><pre>${err.message}</pre>`, 500);
  }
});

console.log(`Server running on http://localhost:${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT
});
