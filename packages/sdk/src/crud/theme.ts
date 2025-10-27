import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import type { Theme } from "../theme.ts";

export interface GetOrgThemeInput {
  locator: ProjectLocator;
  orgId: number;
}

export interface UpdateOrgThemeInput {
  locator: ProjectLocator;
  orgId: number;
  theme: Theme;
}

export const getOrgThemeDirectly = async (
  input: GetOrgThemeInput,
  init?: RequestInit,
): Promise<Theme | null> => {
  const result = await MCPClient.forLocator(input.locator).THEME_GET_ORG(
    { orgId: input.orgId },
    init,
  );
  return (result as { theme: Theme | null }).theme;
};

export const updateOrgTheme = async (
  input: UpdateOrgThemeInput,
  init?: RequestInit,
): Promise<Theme> => {
  const result = await MCPClient.forLocator(input.locator).THEME_UPDATE_ORG(
    { orgId: input.orgId, theme: input.theme },
    init,
  );
  return (result as { theme: Theme }).theme;
};
