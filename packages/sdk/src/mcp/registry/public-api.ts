/**
 * Public Registry API Tools
 *
 * Implements public versions of registry tools that:
 * - Only expose public apps (unlisted: false)
 * - Remove sensitive fields (connection, workspace, etc.)
 * - Support filtering, sorting, and pagination
 * - Are accessible without authentication
 * - Follow MCP Registry Spec format
 */

import { z } from "zod";
import { createToolGroup } from "../context.ts";
import { registryApps, registryScopes, registryTools } from "../schema.ts";
import { mapAppToPublic } from "./api.ts";

type DbTool = typeof registryTools.$inferSelect;
type DbApp = typeof registryApps.$inferSelect & { tools: DbTool[] } & {
  scope: Pick<typeof registryScopes.$inferSelect, "scope_name">;
};

// Apps to omit from marketplace/discover
const OMITTED_APPS = [
  "9cecc7d6-d114-44b4-96e3-d4d06faf2c2f",
  "4c5aeb03-6b3d-4b58-bb14-4a0d7ecd4d14",
  "f5fe9093-67a6-416c-8fac-b77d3edf52e0",
  "6bc2c3e3-8858-49cd-b603-ca183e4f4f19",
  "f2bd7ca4-61fb-4dff-9753-45e5b8a85693",
  "0696cdb3-e6da-46ea-93af-e6524cabaa75",
  "5bd518f9-21f6-477f-8fbc-927b1a03018b",
  "b0ae29d5-7220-423c-b57b-d0bbe3816120",
  "fc348403-4bb9-4b95-8cda-b73e8beac4fd",
  "1e810c3c-9da2-4e5e-8312-8e54f125d6bf",
];

// MCP Registry API base URL for DecoCMS
const DECO_MCP_BASE_URL = "https://mcp.decocms.com";

/**
 * Helper to ensure date is ISO string
 */
const ensureISOString = (date: unknown): string => {
  if (date instanceof Date) {
    return date.toISOString();
  }
  if (typeof date === "string") {
    try {
      return new Date(date).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  return new Date().toISOString();
};

/**
 * Map a database app to MCP Registry Spec format with Collection Entity fields
 * https://spec.modelcontextprotocol.io/specification/2025-03-26/registry/
 */
const mapAppToMCPRegistryServer = (app: DbApp) => {
  const serverName = `io.decocms/${app.scope.scope_name}/${app.name}`;

  return {
    // Collection Entity base fields
    id: app.id,
    title: app.friendly_name || app.name,
    created_at: ensureISOString(app.created_at),
    updated_at: ensureISOString(app.updated_at),
    // MCP Registry Spec structure
    _meta: {
      // DecoCMS specific metadata
      "io.decocms": {
        id: app.id,
        verified: app.verified ?? false,
        scopeName: app.scope.scope_name,
        appName: app.name,
      },
    },
    server: {
      $schema:
        "https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json",
      _meta: {
        // Publisher provided metadata
        "io.decocms/publisher-provided": {
          friendlyName: app.friendly_name ?? null,
          metadata: app.metadata ?? null,
          tools: app.tools.map((tool) => ({
            id: tool.id,
            name: tool.name,
            description: tool.description ?? null,
          })),
        },
      },
      name: serverName,
      title: app.friendly_name || app.name,
      description: app.description ?? undefined,
      icons: app.icon
        ? [
            {
              src: app.icon,
              mimeType: "image/png",
            },
          ]
        : undefined,
      // Remote MCP endpoint (streamable HTTP)
      remotes: [
        {
          type: "http" as const,
          url: `${DECO_MCP_BASE_URL}/${app.scope.scope_name}/${app.name}/mcp`,
        },
      ],
      // Version info (using updated_at as proxy for version)
      version: app.updated_at
        ? new Date(app.updated_at).toISOString().split("T")[0].replace(/-/g, ".")
        : "1.0.0",
    },
  };
};

/**
 * Map a database app to MCP Registry Spec format for GET (single server)
 */
const mapAppToMCPRegistryServerDetail = (app: DbApp) => {
  const base = mapAppToMCPRegistryServer(app);

  return {
    ...base,
    _meta: {
      ...base._meta,
      "io.decocms": {
        ...base._meta["io.decocms"],
        // Additional detail fields
        publishedAt: app.created_at
          ? new Date(app.created_at).toISOString()
          : undefined,
        updatedAt: app.updated_at
          ? new Date(app.updated_at).toISOString()
          : undefined,
      },
    },
  };
};

// MCP Registry Spec Schemas
const MCPRegistryServerSchema = z.object({
  _meta: z.record(z.unknown()).optional(),
  server: z.object({
    $schema: z.string().optional(),
    _meta: z.record(z.unknown()).optional(),
    name: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    icons: z
      .array(
        z.object({
          src: z.string(),
          mimeType: z.string().optional(),
          sizes: z.array(z.string()).optional(),
          theme: z.enum(["light", "dark"]).optional(),
        }),
      )
      .optional(),
    remotes: z
      .array(
        z.object({
          type: z.enum(["http", "stdio", "sse"]),
          url: z.string().optional(),
          headers: z.array(z.unknown()).optional(),
        }),
      )
      .optional(),
    packages: z.array(z.unknown()).optional(),
    repository: z
      .object({
        url: z.string(),
        source: z.string().optional(),
        subfolder: z.string().optional(),
      })
      .optional(),
    version: z.string().optional(),
    websiteUrl: z.string().optional(),
  }),
});

const MCPRegistryListOutputSchema = z.object({
  metadata: z.object({
    count: z.number().int().min(0),
    nextCursor: z.string().nullable(),
  }),
  servers: z.array(MCPRegistryServerSchema),
});

const MCPRegistryGetOutputSchema = z.object({
  server: MCPRegistryServerSchema.nullable(),
});

const createPublicTool = createToolGroup("Registry", {
  name: "App Registry (Public)",
  description: "Discover published apps in the registry.",
  icon: "https://assets.decocache.com/mcp/09e44283-f47d-4046-955f-816d227c626f/app.png",
});

/**
 * Public version of listRegistryApps
 * Lists all PUBLIC apps (unlisted: false) with filtering, sorting, and pagination
 * Does NOT require authentication
 * Returns data in MCP Registry Spec format
 */
export const listPublicRegistryApps = createPublicTool({
  name: "COLLECTION_REGISTRY_APP_LIST",
  description:
    "List all public apps in the registry with filtering, sorting, and pagination support",
  inputSchema: z.lazy(() =>
    z.object({
      where: z.unknown().optional().describe("Filter expression"),
      orderBy: z.unknown().optional().describe("Sort expressions"),
      limit: z.unknown().optional().describe("Maximum number of items to return"),
      offset: z.unknown().optional().describe("Number of items to skip"),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(MCPRegistryServerSchema),
      totalCount: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Total number of matching items"),
      hasMore: z
        .boolean()
        .optional()
        .describe("Whether there are more items available"),
    }),
  ),
  handler: async (
    input, // eslint-disable-line @typescript-eslint/no-unused-vars
    c: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) => {
    // Public access - grant access unconditionally (no auth needed)
    // This tool lists only public apps (unlisted: false), so authentication is not required
    c.resourceAccess.grant();

    // Get database context for accessing public apps
    const drizzle = c.drizzle;
    if (!drizzle) {
      throw new Error("Database context not available");
    }

    // Parse and validate pagination inputs with fallbacks
    const limit = Math.max(1, Math.min(1000, Number(input?.limit) || 50));
    const offset = Math.max(0, Number(input?.offset) || 0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const where = input?.where;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const orderBy = input?.orderBy;

    // Query only public apps (unlisted: false)
    const apps = await drizzle.query.registryApps.findMany({
      where: {
        unlisted: false, // Only public apps
      },
      with: {
        tools: true,
        scope: { columns: { scope_name: true } },
      },
      orderBy: (
        a: any, // eslint-disable-line @typescript-eslint/no-explicit-any
        { desc: descFn }: any, // eslint-disable-line @typescript-eslint/no-explicit-any
      ) => descFn(a.created_at),
    });

    // Filter out omitted apps
    const filteredApps = apps.filter(
      (app: DbApp) => !OMITTED_APPS.includes(app.id),
    );

    // TODO: Apply where filters if provided (currently filtering only by unlisted=false)
    // TODO: Apply orderBy sorting if provided (currently sorting by created_at descending)

    // Apply pagination
    const totalCount = filteredApps.length;
    const paginated = filteredApps.slice(offset, offset + limit);
    const hasMore = filteredApps.length > offset + limit;

    // Map to MCP Registry Spec format (includes all public metadata)
    const servers = paginated.map((app: DbApp) => mapAppToMCPRegistryServer(app));

    return {
      items: servers,
      totalCount,
      hasMore,
    };
  },
});

/**
 * Public version of getRegistryApp
 * Gets a single PUBLIC MCP server by name (format: scope/app)
 * Returns null if server is not found or if it's private (unlisted: true)
 * Does NOT require authentication
 * Returns data in MCP Registry Spec format
 */
export const getPublicRegistryApp = createPublicTool({
  name: "COLLECTION_REGISTRY_APP_GET",
  description: "Get a public app from the registry by ID",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the app to get"),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      item: MCPRegistryServerSchema.nullable().describe(
        "The retrieved server in MCP Registry Spec format, or null if not found or not public",
      ),
    }),
  ),
  handler: async (
    { id },
    c: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) => {
    // Public access - grant access unconditionally (no auth needed)
    // This tool retrieves only public apps (unlisted: false), so authentication is not required
    c.resourceAccess.grant();

    // Get database context for accessing public apps
    const drizzle = c.drizzle;
    if (!drizzle) {
      throw new Error("Database context not available");
    }

    // Query for the app by ID
    const app = await drizzle.query.registryApps.findFirst({
      where: {
        id,
        unlisted: false, // Only public apps
      },
      with: {
        tools: true,
        scope: { columns: { scope_name: true } },
      },
    });

    if (!app || OMITTED_APPS.includes(app.id)) {
      // Return null for not found or private apps
      return {
        item: null,
      };
    }

    const serverData = mapAppToMCPRegistryServerDetail(app as DbApp);

    return {
      item: serverData,
    };
  },
});

/**
 * All public registry tools
 */
export const publicRegistryTools = [
  listPublicRegistryApps,
  getPublicRegistryApp,
] as const;
