/**
 * Add Default deco MCP Registry
 *
 * Adds the official deco MCP registry connection to all existing organizations
 * that don't already have it.
 */

import { type Kysely, sql } from "kysely";
import { nanoid } from "nanoid";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Get all organizations
  const organizations = await sql<{
    id: string;
    createdBy: string | null;
  }>`SELECT id, "createdBy" FROM organization`.execute(db);

  console.log(`Found ${organizations.rows.length} organizations`);

  // Add default registry for each organization that doesn't have it
  for (const org of organizations.rows) {
    // Check if organization already has the registry
    const existing = await sql<{
      count: number;
    }>`
      SELECT COUNT(*) as count 
      FROM connections 
      WHERE organization_id = ${org.id}
      AND connection_url = ${"https://api.decocms.com/mcp/registry"}
    `.execute(db);

    if (existing.rows[0]?.count === 0) {
      const connectionId = nanoid();
      const now = new Date().toISOString();

      await sql`
        INSERT INTO connections (
          id, organization_id, created_by, title, description, icon, app_name, app_id,
          connection_type, connection_url, connection_token, connection_headers,
          oauth_config, configuration_state, configuration_scopes, metadata, tools, bindings,
          status, created_at, updated_at
        ) VALUES (
          ${connectionId},
          ${org.id},
          ${org.createdBy || "system"},
          ${"Deco Store"},
          ${"Official deco MCP registry with curated integrations"},
          ${"https://assets.decocache.com/decocms/00ccf6c3-9e13-4517-83b0-75ab84554bb9/596364c63320075ca58483660156b6d9de9b526e.png"},
          ${"deco-registry"},
          ${null},
          ${"HTTP"},
          ${"https://api.decocms.com/mcp/registry"},
          ${null},
          ${null},
          ${null},
          ${null},
          ${null},
          ${JSON.stringify({ isDefault: true, type: "registry" })},
          ${null},
          ${null},
          ${"active"},
          ${now},
          ${now}
        )
      `.execute(db);

      console.log(`✅ Added default registry for organization ${org.id}`);
    } else {
      console.log(`⏭️  Organization ${org.id} already has the registry`);
    }
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Remove default registry connections
  await sql`
    DELETE FROM connections 
    WHERE connection_url = ${"https://api.decocms.com/mcp/registry"}
    AND json_extract(metadata, '$.isDefault') = ${true}
  `.execute(db);

  console.log("✅ Removed default registry connections");
}
