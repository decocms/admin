import { MCPClient } from "../fetcher.ts";
import type { MCPConnection } from "../models/mcp.ts";
import type { Theme } from "../theme.ts";
import { ProjectLocator } from "../locator.ts";
import { View } from "../views.ts";

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
  resources: Resource[];
}

export interface Resource {
  id: string;
  title: string;
  icon: string;
  type: "resource";
  name: string;
  resource_type: string;
  integration_id: string;
  created_at: string;
  updated_at: string;
}

export interface TeamWithResources extends Team {
  resources: Resource[];
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
  slug: string;
  stripe_subscription_id?: string;
  [key: string]: unknown;
}

export const createTeam = (
  input: CreateTeamInput,
  init?: RequestInit,
): Promise<Team> => MCPClient.TEAMS_CREATE(input, init) as Promise<Team>;

export const getOrgTheme = (
  slug: string,
  init?: RequestInit,
): Promise<{ theme?: Theme } | null> =>
  MCPClient.GET_ORG_THEME({ slug }, init) as Promise<{
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

export const deleteTeam = (teamId: number, init?: RequestInit) =>
  MCPClient.TEAMS_DELETE({ teamId }, init);

export interface AddViewInput {
  view: {
    id: string;
    title: string;
    icon: string;
    type: "custom";
    name: string;
    tools?: string[];
    rules?: string[];
    integration: {
      id: string;
    };
  };
}

export const addView = (
  locator: ProjectLocator,
  input: AddViewInput,
  init?: RequestInit,
): Promise<View> =>
  MCPClient.forLocator(locator)
    .TEAMS_ADD_VIEW(input, init)
    .then((v) => v as unknown as View);

export interface RemoveViewInput {
  viewId: string;
}

export const removeView = (
  locator: ProjectLocator,
  input: RemoveViewInput,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forLocator(locator).TEAMS_REMOVE_VIEW(input, init) as Promise<{
    success: boolean;
  }>;

export interface AddResourceInput {
  resource: {
    id: string;
    title: string;
    icon: string;
    type: "custom";
    name: string;
    resourceType: string;
    integration: {
      id: string;
    };
  };
}

export const addResource = (
  locator: ProjectLocator,
  input: AddResourceInput,
  init?: RequestInit,
): Promise<Resource> =>
  MCPClient.forLocator(locator)
    .TEAMS_ADD_VIEW(
      {
        view: {
          id: input.resource.id,
          title: input.resource.title,
          icon: input.resource.icon,
          type: "resource" as const,
          name: input.resource.name,
          integration: input.resource.integration,
          resourceType: input.resource.resourceType,
          tools: [],
          rules: [],
        },
      },
      init,
    )
    .then((r) => r as unknown as Resource);

export interface RemoveResourceInput {
  resourceId: string;
}

export const removeResource = (
  locator: ProjectLocator,
  input: RemoveResourceInput,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forLocator(locator).TEAMS_REMOVE_VIEW(
    {
      viewId: input.resourceId,
    },
    init,
  ) as Promise<{
    success: boolean;
  }>;

type ViewListItem = {
  name?: string;
  title: string;
  icon: string;
  url: string;
  mimeTypePattern?: string;
  resourceName?: string;
  rules?: string[];
  tools?: string[];
  installBehavior?: "none" | "open" | "autoPin";
  prompt?: string;
  instructions?: string;
};

export const listAvailableViewsForConnection = async (
  connection: MCPConnection,
): Promise<{ views: ViewListItem[] }> => {
  try {
    const result = await MCPClient.INTEGRATIONS_CALL_TOOL({
      connection,
      params: {
        name: "DECO_CHAT_VIEWS_LIST",
        arguments: {},
      },
    });

    if (typeof result.isError === "boolean" && result.isError) {
      const firstContent = Array.isArray(result.content)
        ? result.content[0]?.text
        : undefined;
      const message = result.structuredContent ?? firstContent;
      throw new Error(JSON.stringify(message));
    }

    const viewsList = result.structuredContent as { views?: ViewListItem[] };

    return {
      views: (viewsList?.views ?? []).map((view) => ({
        ...view,
        name: view.name ?? view.title,
      })),
    };
  } catch (error) {
    console.error("Error listing available views for connection:", error);
    return { views: [] };
  }
};
