import { defineRelations } from "drizzle-orm";
import * as schema from "./schema.ts";

export const relations = defineRelations(schema, (r) => ({
  registryApps: {
    tools: r.many.registryTools({
      from: r.registryApps.id,
      to: r.registryTools.app_id,
    }),
    scope: r.one.registryScopes({
      from: r.registryApps.scope_id,
      to: r.registryScopes.id,
      optional: false,
    }),
  },
  registryTools: {
    app: r.one.registryApps({
      from: r.registryTools.app_id,
      to: r.registryApps.id,
    }),
  },
  registryScopes: {
    apps: r.many.registryApps({
      from: r.registryScopes.id,
      to: r.registryApps.scope_id,
    }),
  },
  organizations: {
    members: r.many.members({
      from: r.organizations.id,
      to: r.members.team_id,
    }),
  },
  members: {
    organization: r.one.organizations({
      from: r.members.team_id,
      to: r.organizations.id,
    }),
    user: r.one.profiles({
      from: r.members.user_id,
      to: r.profiles.user_id,
    }),
  },
}));
