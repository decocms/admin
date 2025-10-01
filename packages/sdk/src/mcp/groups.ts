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

export const getGroupByAppName = (appName?: string | null) => {
  if (!appName) {
    return undefined;
  }
  const wellKnownName = Object.entries(WellKnownAppNames).find(
    ([_, name]) => name === appName,
  )?.[0];
  if (!wellKnownName) {
    return undefined;
  }
  return WellKnownMcpGroups[wellKnownName as WellKnownMcpGroup];
};

export const getAppNameFromGroup = (group: string) => {
  const wellKnownName = Object.entries(WellKnownMcpGroups).find(
    ([_, name]) => name === group,
  )?.[0];
  if (!wellKnownName) {
    return undefined;
  }
  return WellKnownAppNames[wellKnownName as keyof typeof WellKnownAppNames];
};

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
