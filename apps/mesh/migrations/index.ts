import { type Migration } from "kysely";
import * as migration001 from "./001-initial-schema.ts";
import * as migration002 from "./002-organization-settings.ts";

const migrations = {
  migration001,
  migration002,
} satisfies Record<string, Migration>;

export default migrations;
