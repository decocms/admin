import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import type { Theme } from "../theme.ts";

export interface UpdateOrgThemeInput {
  locator: ProjectLocator;
  theme: Theme;
}

export const updateOrgTheme = async (
  input: UpdateOrgThemeInput,
  init?: RequestInit,
): Promise<Theme> => {
  const result = await MCPClient.forLocator(input.locator).UPDATE_ORG_THEME(
    { theme: input.theme },
    init,
  );
  return (result as { theme: Theme }).theme;
};
