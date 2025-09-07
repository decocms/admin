/**
 * This is the main entry point for your application and
 * MCP server. This is a Cloudflare workers app, and serves
 * both your MCP server at /mcp and your views as a react
 * application at /. It also serves MCP proxy endpoints at
 * /:project/:branch/:integration_id/mcp for mesh apps.
 */
import { DefaultEnv, withRuntime } from "@deco/workers-runtime";
import { type Env as DecoEnv, StateSchema } from "./deco.gen.ts";
import { Hono } from "hono";

import { tools } from "./tools/index.ts";
import { views } from "./views.ts";

// Export Durable Objects

const Schema = StateSchema;
/**
 * This Env type is the main context object that is passed to
 * all of your Application.
 *
 * It includes all of the generated types from your
 * Deco bindings, along with the default ones.
 */
export type Env = DefaultEnv<typeof Schema> &
  DecoEnv & {
    ASSETS: {
      fetch: (request: Request) => Promise<Response>;
    };
  };

// Helper to get installation file path
const getInstallationPath = (installationId: string) => `/installations/${installationId}.json`;

// MCP proxy functionality for mesh apps
const createMeshProxy = async (env: Env, branch: string, installationId: string) => {
  // Get the app installation from DECONFIG
  const path = getInstallationPath(installationId);
  
  try {
    const fileData = await env.DECONFIG.READ_FILE({
      branch,
      path,
    });

    const content = atob(fileData.content);
    const installation = JSON.parse(content);
    
    // Create a simple proxy that forwards requests
    const proxyFetch = async (req: Request) => {
      const connection = installation.connection;
      
      // Simple HTTP-based proxy
      if (connection.type === "HTTP") {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        
        if (connection.token) {
          headers["Authorization"] = `Bearer ${connection.token}`;
        }
        
        return await fetch(connection.url, {
          method: req.method,
          headers: {
            ...headers,
            ...Object.fromEntries(req.headers.entries()),
          },
          body: req.body,
        });
      }
      
      // For other connection types, return a placeholder response
      return new Response(
        JSON.stringify({ 
          error: "Connection type not yet supported",
          type: connection.type 
        }),
        { 
          status: 501,
          headers: { "Content-Type": "application/json" }
        }
      );
    };
    
    return proxyFetch;
  } catch (error) {
    // Return error response if installation not found
    return () => new Response(
      JSON.stringify({ 
        error: "App installation not found",
        installationId 
      }),
      { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

// Create Hono app for custom routing
const createHonoApp = (env: Env) => {
  const app = new Hono();

  // Mesh proxy route: /:project/:branch/:integration_id/mcp
  app.all("/:project/:branch/:integration_id/mcp/*", async (c) => {
    const { project, branch, integration_id } = c.req.param();
    
    // Create proxy for this installation
    const proxyFetch = await createMeshProxy(env, branch, integration_id);
    
    // Forward the request
    return await proxyFetch(c.req.raw);
  });

  // Mesh proxy route without wildcard: /:project/:branch/:integration_id/mcp
  app.all("/:project/:branch/:integration_id/mcp", async (c) => {
    const { project, branch, integration_id } = c.req.param();
    
    // Create proxy for this installation
    const proxyFetch = await createMeshProxy(env, branch, integration_id);
    
    // Forward the request
    return await proxyFetch(c.req.raw);
  });

  // Fallback to serve static assets or other routes
  app.all("*", async (c) => {
    // Try to serve from assets first
    if (env.ASSETS) {
      try {
        const response = await env.ASSETS.fetch(c.req.raw);
        if (response.status !== 404) {
          return response;
        }
      } catch (error) {
        // Continue to next handler if assets fail
      }
    }
    
    // Return 404 for unmatched routes
    return new Response("Not Found", { status: 404 });
  });

  return app;
};

// Runtime with custom fetch handler using Hono
const { Workflow, ...runtime } = withRuntime<Env>({
  workflows: [],
  tools,
  fetch: (request: Request, env: Env) => {
    const url = new URL(request.url);
    
    // Handle MCP routes with Hono
    if (url.pathname.includes("/mcp") && url.pathname.split("/").length >= 4) {
      const app = createHonoApp(env);
      return app.fetch(request, env);
    }
    
    // Default behavior for other routes (serve assets)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    
    return new Response("Not Found", { status: 404 });
  },
});

export { Workflow };
export default runtime;
