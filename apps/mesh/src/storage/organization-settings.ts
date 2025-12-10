import type { Kysely } from "kysely";
import type { Database, OrganizationSettings } from "./types";
import type { OrganizationSettingsStoragePort } from "./ports";

export class OrganizationSettingsStorage
  implements OrganizationSettingsStoragePort
{
  constructor(private readonly db: Kysely<Database>) {}

  async get(organizationId: string): Promise<OrganizationSettings | null> {
    const record = await this.db
      .selectFrom("organization_settings")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();

    if (!record) {
      return null;
    }

    return {
      organizationId: record.organizationId,
      sidebar_items: record.sidebar_items
        ? typeof record.sidebar_items === "string"
          ? JSON.parse(record.sidebar_items)
          : record.sidebar_items
        : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async upsert(
    organizationId: string,
    data?: Partial<Pick<OrganizationSettings, "sidebar_items">>,
  ): Promise<OrganizationSettings> {
    const now = new Date().toISOString();
    const sidebarItemsJson = data?.sidebar_items
      ? JSON.stringify(data.sidebar_items)
      : null;

    await this.db
      .insertInto("organization_settings")
      .values({
        organizationId,
        sidebar_items: sidebarItemsJson,
        createdAt: now,
        updatedAt: now,
      })
      .onConflict((oc) => {
        const updateSet: {
          sidebar_items?: string | null;
          updatedAt: string;
        } = {
          updatedAt: now,
        };

        // Only update sidebar_items if it was explicitly provided in data
        if (data !== undefined && "sidebar_items" in data) {
          updateSet.sidebar_items = sidebarItemsJson;
        }

        return oc.doUpdateSet(updateSet);
      })
      .execute();

    const settings = await this.get(organizationId);
    if (!settings) {
      // Should not happen, but return synthesized value in case of race conditions
      return {
        organizationId,
        sidebar_items: data?.sidebar_items ?? null,
        createdAt: now,
        updatedAt: now,
      };
    }

    return settings;
  }
}
