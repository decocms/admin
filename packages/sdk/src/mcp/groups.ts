import {
  WellKnownAppNames,
  WellKnownMcpGroup,
  WellKnownMcpGroups,
} from "../crud/groups.ts";
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

export const getApps = () => {
  const idToWellKnownName = Object.fromEntries(
    Object.entries(WellKnownMcpGroups).map(([group, integration]) => [
      integration,
      group,
    ]),
  );
  return Object.entries(groups)
    .map(([groupname, integration]) => {
      const wellKnownName: WellKnownMcpGroup | undefined = idToWellKnownName[
        groupname
      ] as WellKnownMcpGroup | undefined;
      if (!wellKnownName) {
        return undefined;
      }
      const group = WellKnownAppNames[wellKnownName];
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
