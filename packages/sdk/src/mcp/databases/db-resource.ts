import { mimeType } from "@deco/workers-runtime/resources";
import { NotFoundError, UserInputError } from "../../index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { impl, WellKnownBindings } from "../bindings/binder.ts";
import { IWorkspaceDB } from "../context.ts";

export interface DBResourceOptions {
  table: string;
  columns: string[];
  db: IWorkspaceDB;
}

export const dbResource = (options: DBResourceOptions) => {
  const { table, columns, db } = options;

  return impl(WellKnownBindings.Resources, [
    // DECO_CHAT_RESOURCES_READ
    {
      description: `Read a resource from the ${table} table`,
      handler: async ({ name, uri }, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "DATABASES_RUN_SQL");

        if (name !== table) {
          throw new UserInputError(`Resource name must be '${table}'`);
        }

        // Extract ID from URI - expecting format like db://table/id
        const urlParts = uri.split("/");
        const id = urlParts[urlParts.length - 1];

        if (!id) {
          throw new UserInputError("Invalid URI: missing resource ID");
        }

        using result = await db.exec({
          sql: `SELECT * FROM ${table} WHERE id = ?`,
          params: [id],
        });

        const rows = result.result[0]?.results as
          | Record<string, unknown>[]
          | undefined;

        if (!rows || rows.length === 0) {
          throw new NotFoundError(`Resource not found: ${uri}`);
        }

        const row = rows[0];
        const data = JSON.stringify(row);
        const detectedMimeType = mimeType(uri) || "application/json";

        return {
          name: table,
          uri,
          data,
          type: "text" as const,
          mimeType: detectedMimeType,
          title: String(row.name || row.title || id),
          description: String(row.description || `${table} resource`),
        };
      },
    },

    // DECO_CHAT_RESOURCES_SEARCH
    {
      description: `Search resources in the ${table} table`,
      handler: async ({ name, term, cursor, limit = 10 }, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "DATABASES_RUN_SQL");

        if (name !== table) {
          throw new UserInputError(`Resource name must be '${table}'`);
        }

        const offset = cursor ? parseInt(cursor, 10) : 0;
        const searchColumns = columns.join(` LIKE ? OR `) + ` LIKE ?`;
        const searchParams = columns.map(() => `%${term}%`);

        using result = await db.exec({
          sql: `SELECT * FROM ${table} WHERE ${searchColumns} LIMIT ? OFFSET ?`,
          params: [...searchParams, limit + 1, offset],
        });

        const rows = (result.result[0]?.results as
          | Record<string, unknown>[]
          | undefined) || [];
        const hasMore = rows.length > limit;
        const items = rows.slice(0, limit);

        return {
          items: items.map((row) => ({
            name: table,
            uri: `db://${table}/${row.id}`,
            title: String(row.name || row.title || row.id),
            description: String(row.description || `${table} resource`),
            mimeType: "application/json",
          })),
          hasMore,
          nextCursor: hasMore ? String(offset + limit) : undefined,
        };
      },
    },

    // DECO_CHAT_RESOURCES_CREATE
    {
      description: `Create a new resource in the ${table} table`,
      handler: async (
        { name, resourceName, title, description, content, metadata },
        c,
      ) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "DATABASES_RUN_SQL");

        if (name !== table) {
          throw new UserInputError(`Resource name must be '${table}'`);
        }

        const id = crypto.randomUUID();
        const uri = `db://${table}/${id}`;
        const now = new Date().toISOString();

        // Parse content data
        let parsedData: Record<string, unknown> = {};
        if (content) {
          try {
            parsedData = content.type === "text"
              ? JSON.parse(content.data)
              : { data: content.data, type: content.type };
          } catch {
            parsedData = { data: content.data };
          }
        }

        // Merge all data
        const resourceData = {
          id,
          name: resourceName,
          title,
          description,
          created_at: now,
          updated_at: now,
          ...parsedData,
          ...metadata,
        };

        // Build dynamic insert
        const columnNames = Object.keys(resourceData);
        const placeholders = columnNames.map(() => "?").join(", ");
        const values = Object.values(resourceData);

        using _ = await db.exec({
          sql: `INSERT INTO ${table} (${
            columnNames.join(
              ", ",
            )
          }) VALUES (${placeholders})`,
          params: values,
        });

        return {
          name: table,
          uri,
          title: title || resourceName,
          description: description || `${table} resource`,
          mimeType: "application/json",
        };
      },
    },

    // DECO_CHAT_RESOURCES_UPDATE
    {
      description: `Update a resource in the ${table} table`,
      handler: async (
        { name, uri, resourceName, title, description, content, metadata },
        c,
      ) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "DATABASES_RUN_SQL");

        if (name !== table) {
          throw new UserInputError(`Resource name must be '${table}'`);
        }

        // Extract ID from URI
        const urlParts = uri.split("/");
        const id = urlParts[urlParts.length - 1];

        if (!id) {
          throw new UserInputError("Invalid URI: missing resource ID");
        }

        const now = new Date().toISOString();

        // Parse content data
        let parsedData: Record<string, unknown> = {};
        if (content) {
          try {
            parsedData = content.type === "text"
              ? JSON.parse(content.data)
              : { data: content.data, type: content.type };
          } catch {
            parsedData = { data: content.data };
          }
        }

        // Build update data
        const updateData: Record<string, unknown> = {
          updated_at: now,
          ...parsedData,
          ...metadata,
        };

        if (resourceName) updateData.name = resourceName;
        if (title) updateData.title = title;
        if (description) updateData.description = description;

        // Build dynamic update
        const updates = Object.keys(updateData)
          .map((key) => `${key} = ?`)
          .join(", ");
        const values = [...Object.values(updateData), id];

        using _ = await db.exec({
          sql: `UPDATE ${table} SET ${updates} WHERE id = ?`,
          params: values,
        });

        return {
          name: table,
          uri,
          title: title || resourceName || table,
          description: description || `${table} resource`,
          mimeType: "application/json",
        };
      },
    },

    // DECO_CHAT_RESOURCES_DELETE
    {
      description: `Delete a resource from the ${table} table`,
      handler: async ({ name, uri }, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "DATABASES_RUN_SQL");

        if (name !== table) {
          throw new UserInputError(`Resource name must be '${table}'`);
        }

        // Extract ID from URI
        const urlParts = uri.split("/");
        const id = urlParts[urlParts.length - 1];

        if (!id) {
          throw new UserInputError("Invalid URI: missing resource ID");
        }

        using _ = await db.exec({
          sql: `DELETE FROM ${table} WHERE id = ?`,
          params: [id],
        });

        return {
          deletedUri: uri,
        };
      },
    },

    // DECO_CHAT_RESOURCES_LIST
    {
      description: `List available resource types`,
      handler: async (_, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "DATABASES_RUN_SQL");

        return {
          resources: [
            {
              name: table,
              icon: "database",
              title: table.charAt(0).toUpperCase() + table.slice(1),
              description: `Database table: ${table}`,
              hasCreate: true,
              hasUpdate: true,
              hasDelete: true,
            },
          ],
        };
      },
    },
  ]);
};
