import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  addView,
  type AddViewInput,
  createTeam,
  type CreateTeamInput,
  deleteTeam,
  getTeam,
  getWorkspaceTheme,
  listAvailableTeamsForDomain,
  listAvailableViewsForConnection,
  listTeams,
  removeView,
  type RemoveViewInput,
  updateTeam,
  type UpdateTeamInput,
} from "../crud/teams.ts";
import { KEYS } from "./api.ts";
import { InternalServerError } from "../errors.ts";
import { DEFAULT_THEME } from "../theme.ts";
import { useSDK } from "./store.tsx";
import { MCPConnection } from "../models/index.ts";
import { listIntegrations } from "../crud/mcp.ts";

export const useTeams = () => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAMS(),
    queryFn: ({ signal }) => listTeams({ signal }),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });
};

export const useTeam = (slug: string = "") => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAM(slug),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    queryFn: ({ signal }) => {
      if (!slug.length) {
        return null;
      }
      return getTeam(slug, { signal });
    },
  });
};

export const useCurrentTeam = () => {
  const { workspace } = useSDK();
  const slug = workspace.split("/")[1] ?? "";
  return useTeam(slug);
};

export const useAvailableTeamsForDomain = () => {
  return useQuery({
    queryKey: KEYS.TEAMS_AVAILABLE_FOR_DOMAIN(),
    queryFn: ({ signal }) => listAvailableTeamsForDomain({ signal }),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });
};

export function useCreateTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamInput) => createTeam(input),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      client.setQueryData(["team", result.slug], result);
    },
  });
}

export function useUpdateTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTeamInput) => updateTeam(input),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      client.setQueryData(["team", result.slug], result);
    },
  });
}

export function useUpdateTeamTheme() {
  const client = useQueryClient();
  const { workspace } = useSDK();
  const slug = workspace.split("/")[1] ?? "";
  
  return useMutation({
    mutationFn: (input: { teamId: string; theme: any }) => 
      updateTeam({
        id: parseInt(input.teamId),
        data: { theme: input.theme }
      }),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      client.invalidateQueries({ queryKey: KEYS.TEAM_THEME(slug) });
      client.setQueryData(["team", result.slug], result);
    },
  });
}

export function useDeleteTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => deleteTeam(teamId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      // Remove all team caches (by id or slug if needed)
    },
  });
}

export function useWorkspaceTheme() {
  const { workspace } = useSDK();
  const slug = workspace.split("/")[1] ?? "";
  return useQuery({
    queryKey: KEYS.TEAM_THEME(slug),
    queryFn: async () => {
      const data = await getWorkspaceTheme(slug);
      const theme = data?.theme ?? {};
      return {
        ...DEFAULT_THEME,
        ...theme,
      };
    },
  });
}

export function useAddView() {
  const client = useQueryClient();
  const { workspace } = useSDK();
  const slug = workspace.split("/")[1] ?? "";

  return useMutation({
    mutationFn: (input: AddViewInput) => addView(workspace, input),
    onSuccess: () => {
      // Invalidate team data to refresh views
      client.invalidateQueries({ queryKey: KEYS.TEAM(slug) });
    },
  });
}

export function useRemoveView() {
  const client = useQueryClient();
  const { workspace } = useSDK();
  const slug = workspace.split("/")[1] ?? "";

  return useMutation({
    mutationFn: (input: RemoveViewInput) => removeView(workspace, input),
    onSuccess: () => {
      // Invalidate team data to refresh views
      client.invalidateQueries({ queryKey: KEYS.TEAM(slug) });
    },
  });
}

export function useConnectionViews(
  integration: { id: string; connection: MCPConnection } | null,
) {
  const { workspace } = useSDK();

  const data = useQuery({
    queryKey: KEYS.TEAM_VIEWS(workspace, integration?.id ?? "null"),
    queryFn: async () => {
      if (!integration) return { views: [] };
      const result = await listAvailableViewsForConnection(
        integration.connection,
      ).catch((error) => {
        console.error(error);
        return { views: [] };
      });

      return result;
    },
  });

  return data;
}

export function useWorkspaceViews() {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.WORKSPACE_VIEWS(workspace),
    queryFn: async ({ signal }) => {
      const integrations = await listIntegrations(
        workspace,
        { binder: "View" },
        signal,
      );
      const promises = integrations.map(async (integration) => {
        const result = await listAvailableViewsForConnection(
          integration.connection,
        ).catch((error) => {
          console.error(error);
          return { views: [] };
        });
        return result.views.map((view) => ({
          ...view,
          integration: {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
            description: integration.description,
          },
        }));
      });
      const results = await Promise.all(promises);
      return results.flat();
    },
  });
}
