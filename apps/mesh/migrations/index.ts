import { type Migration } from "kysely";
import * as migration001initialschema from "./001-initial-schema.ts";
import * as migration002organizationsettings from "./002-organization-settings.ts";
import * as migration003connectionschemaalign from "./003-connection-schema-align.ts";

const migrations = {
  "001-initial-schema": migration001initialschema,
  "002-organization-settings": migration002organizationsettings,
  "003-connection-schema-align": migration003connectionschemaalign,
} satisfies Record<string, Migration>;

export default migrations;
