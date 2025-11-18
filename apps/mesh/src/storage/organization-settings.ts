import type { Kysely } from "kysely";
import type {
  Database,
  OrganizationSettings,
} from "./types";
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
      modelsBindingConnectionId: record.modelsBindingConnectionId ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async upsert(
    organizationId: string,
    data: { modelsBindingConnectionId: string | null },
  ): Promise<OrganizationSettings> {
    const now = new Date().toISOString();

    await this.db
      .insertInto("organization_settings")
      .values({
        organizationId,
        modelsBindingConnectionId: data.modelsBindingConnectionId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflict((oc) =>
        oc.column("organizationId").doUpdateSet({
          modelsBindingConnectionId: data.modelsBindingConnectionId,
          updatedAt: now,
        }),
      )
      .execute();

    const settings = await this.get(organizationId);
    if (!settings) {
      // Should not happen, but return synthesized value in case of race conditions
      return {
        organizationId,
        modelsBindingConnectionId: data.modelsBindingConnectionId,
        createdAt: now,
        updatedAt: now,
      };
    }

    return settings;
  }
}
