import { MCPClient } from "../fetcher.ts";
import type { Theme } from "../theme.ts";
import { View } from "../views.ts";
import type { MCPConnection } from "../models/mcp.ts";
import { WellKnownBindings } from "../mcp/bindings/index.ts";

export interface Team {
  id: number;
  name: string;
  slug: string;
  avatar_url?: string;
  theme?: Theme;
  created_at: string;
}

export interface TeamWithViews extends Team {
  views: View[];
}

export const listTeams = (init?: RequestInit): Promise<Team[]> =>
  MCPClient.TEAMS_LIST({}, init).then((res) => res.items) as Promise<Team[]>;

export const getTeam = (
  slug: string,
  init?: RequestInit,
): Promise<TeamWithViews> =>
  MCPClient.TEAMS_GET({ slug }, init) as Promise<TeamWithViews>;

export interface CreateTeamInput {
  name: string;
  slug?: string;
  stripe_subscription_id?: string;
  [key: string]: unknown;
}

export const createTeam = (
  input: CreateTeamInput,
  init?: RequestInit,
): Promise<Team> => MCPClient.TEAMS_CREATE(input, init) as Promise<Team>;

export const getWorkspaceTheme = (
  slug: string,
  init?: RequestInit,
): Promise<{ theme?: Theme } | null> =>
  MCPClient.TEAMS_GET_THEME({ slug }, init) as Promise<{
    theme?: Theme;
  } | null>;

export interface UpdateTeamInput {
  id: number;
  data: Partial<
    Pick<Team, "name" | "slug" | "theme"> & { stripe_subscription_id?: string }
  >;
  [key: string]: unknown;
}

export const updateTeam = (
  input: UpdateTeamInput,
  init?: RequestInit,
): Promise<Team> => MCPClient.TEAMS_UPDATE(input, init) as Promise<Team>;

export const listAvailableTeamsForDomain = (init?: RequestInit) =>
  MCPClient.TEAMS_LIST_AVAILABLE_FOR_DOMAIN({}, init) as Promise<{
    items: (Team & { domainSharing?: any })[];
  }>;

export const deleteTeam = (
  teamId: number,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.TEAMS_DELETE({ teamId }, init) as Promise<{ success: boolean }>;

export interface AddViewInput {
  view: {
    id: string;
    title: string;
    icon: string;
    type: "custom";
    url: string;
  };
}

export const addView = (
  workspace: string,
  input: AddViewInput,
  init?: RequestInit,
): Promise<View> =>
  MCPClient.forWorkspace(workspace).TEAMS_ADD_VIEW(
    input,
    init,
  ) as Promise<View>;

export interface RemoveViewInput {
  viewId: string;
}

export const removeView = (
  workspace: string,
  input: RemoveViewInput,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forWorkspace(workspace).TEAMS_REMOVE_VIEW(input, init) as Promise<{
    success: boolean;
  }>;

export const listAvailableViewsForConnection = async (
  connection: MCPConnection,
) => {
  try {
    const client =
      MCPClient.forConnection<(typeof WellKnownBindings)["View"]>(connection);
    const result = await client.DECO_CHAT_VIEWS_LIST({});
    return result;
  } catch (error) {
    console.error("Error listing available views for connection:", error);
    return { views: [] };
  }
};
