/**
 * Organization Hooks
 *
 * Hooks that run when organizations are created/updated.
 * Used to auto-provision default resources like the Deco Store registry.
 */

import { nanoid } from "nanoid";
import { getDb } from "../database";

// Registry tools discovered from https://api.decocms.com/mcp/registry
const REGISTRY_TOOLS = [
  {
    name: "COLLECTION_REGISTRY_APP_LIST",
    description:
      "List all public apps in the registry with filtering, sorting, and pagination support",
    inputSchema: {
      type: "object",
      properties: {
        where: { description: "Filter expression" },
        orderBy: { description: "Sort expressions" },
        limit: { description: "Maximum number of items to return" },
        offset: { description: "Number of items to skip" },
      },
      additionalProperties: false,
      $schema: "http://json-schema.org/draft-07/schema#",
    },
    outputSchema: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "object" } },
        totalCount: {
          type: "integer",
          minimum: 0,
          description: "Total number of matching items",
        },
        hasMore: {
          type: "boolean",
          description: "Whether there are more items available",
        },
      },
      required: ["items"],
      additionalProperties: false,
      $schema: "http://json-schema.org/draft-07/schema#",
    },
  },
  {
    name: "COLLECTION_REGISTRY_APP_GET",
    description: "Get a public app from the registry by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The ID of the app to get" },
      },
      required: ["id"],
      additionalProperties: false,
      $schema: "http://json-schema.org/draft-07/schema#",
    },
    outputSchema: {
      type: "object",
      properties: {
        item: {
          anyOf: [{ type: "object" }, { type: "null" }],
          description:
            "The retrieved server in MCP Registry Spec format, or null if not found or not public",
        },
      },
      required: ["item"],
      additionalProperties: false,
      $schema: "http://json-schema.org/draft-07/schema#",
    },
  },
];

/**
 * Adds the default Deco Store registry to an organization
 */
export async function addDefaultRegistry(
  organizationId: string,
  userId: string,
): Promise<void> {
  console.log(
    `📦 [addDefaultRegistry] Starting for org: ${organizationId}, user: ${userId}`,
  );

  try {
    const db = getDb();
    console.log("✅ [addDefaultRegistry] Got database connection");

    // Check if organization already has the registry
    console.log(
      "🔍 [addDefaultRegistry] Checking if registry already exists...",
    );
    const existing = await db
      .selectFrom("connections")
      .select("id")
      .where("organization_id", "=", organizationId)
      .where("connection_url", "=", "https://api.decocms.com/mcp/registry")
      .executeTakeFirst();

    if (existing) {
      console.log(
        `⏭️  [addDefaultRegistry] Organization ${organizationId} already has Deco Store`,
      );
      return;
    }

    console.log(
      "➕ [addDefaultRegistry] No existing registry found, adding new one...",
    );

    // Add the Deco Store
    const connectionId = nanoid();
    const now = new Date().toISOString();

    console.log(
      `🔑 [addDefaultRegistry] Generated connection ID: ${connectionId}`,
    );

    await db
      .insertInto("connections")
      .values({
        id: connectionId,
        organization_id: organizationId,
        created_by: userId,
        title: "Deco Store",
        description: "Official deco MCP registry with curated integrations",
        icon: "https://assets.decocache.com/decocms/00ccf6c3-9e13-4517-83b0-75ab84554bb9/596364c63320075ca58483660156b6d9de9b526e.png",
        app_name: "deco-registry",
        app_id: null,
        connection_type: "HTTP",
        connection_url: "https://api.decocms.com/mcp/registry",
        connection_token: null,
        connection_headers: null,
        oauth_config: null,
        configuration_state: null,
        configuration_scopes: null,
        metadata: JSON.stringify({ isDefault: true, type: "registry" }),
        tools: JSON.stringify(REGISTRY_TOOLS),
        bindings: null,
        status: "active",
        created_at: now,
        updated_at: now,
      })
      .execute();

    console.log(
      `✅ [addDefaultRegistry] Successfully added Deco Store to organization ${organizationId}`,
    );
  } catch (error) {
    console.error(
      `❌ [addDefaultRegistry] Failed to add Deco Store to organization ${organizationId}:`,
      error,
    );
    // Don't throw - we don't want to block organization creation
  }
}
