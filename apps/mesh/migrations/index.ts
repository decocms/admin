import { type Migration } from "kysely";
import * as migration_001_initial_schema from "./001-initial-schema.ts";
import * as migration_002_organization_settings from "./002-organization-settings.ts";

const migrations = {
  "001-initial-schema": migration_001_initial_schema,
  "002-organization-settings": migration_002_organization_settings,
} satisfies Record<string, Migration>;

export default migrations;
