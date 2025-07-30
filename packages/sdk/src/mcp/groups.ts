import type { Integration } from "../models/index.ts";

export type GroupIntegration = Omit<Integration, "id" | "connection"> & {
  workspace?: false;
};
const groups: Record<string, GroupIntegration> = {};

export function addGroup(group: string, integration: GroupIntegration) {
  groups[group] = integration;
}

export const getGroups = () => groups;
