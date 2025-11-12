import { WellKnownAppNames, WellKnownMcpGroups } from "../crud/groups.ts";
import type { Integration } from "../models/index.ts";
export { WellKnownAppNames, WellKnownMcpGroups } from "../crud/groups.ts";
export type GroupIntegration = Omit<Integration, "id" | "connection"> & {
  workspace?: false;
};
const groups: Record<string, GroupIntegration> = {};

export function addGroup(group: string, integration: GroupIntegration) {
  groups[group] = integration;
}

export const getGroups = () => groups;

// Pre-register agents-v2 group to ensure it's available for virtual integration lookups
addGroup(WellKnownMcpGroups.AgentsV2, {
  name: "Agents V2",
  description:
    "Manage agents, threads, and models using Resources 2.0 with Deconfig storage",
  icon: "https://assets.decocache.com/mcp/6f6bb7ac-e2bd-49fc-a67c-96d09ef84993/Agent-Management.png",
  created_at: new Date().toISOString(),
});

export const getGroupByAppName = (appName?: string | null) => {
  if (!appName) {
    return undefined;
  }
  const inverseWellKnownAppNames = Object.fromEntries(
    Object.entries(WellKnownAppNames).map(([group, name]) => [name, group]),
  );
  return inverseWellKnownAppNames[appName];
};

export const getAppNameFromGroup = (group: string) => {
  return WellKnownAppNames[group as keyof typeof WellKnownAppNames];
};

export const getApps = () => {
  return Object.entries(groups)
    .map(([groupname, integration]) => {
      const group =
        WellKnownAppNames[groupname as keyof typeof WellKnownAppNames];
      if (!group) {
        return undefined;
      }
      return {
        ...integration,
        group,
      };
    })
    .filter(Boolean);
};
