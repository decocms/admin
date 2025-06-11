import { z } from "zod";
import { NotFoundError, UserInputError } from "../../errors.ts";
import {
  assertPrincipalIsUser,
  assertTeamResourceAccess,
} from "../assertions.ts";
import { createTool } from "../context.ts";
import { Json } from "../../storage/index.ts";
import { Theme } from "../../theme.ts";

const OWNER_ROLE_ID = 1;

export const sanitizeTeamName = (name: string): string => {
  if (!name) return "";
  const nameWithoutAccents = removeNameAccents(name);
  return nameWithoutAccents.trim().replace(/\s+/g, " ").replace(
    /[^\w\s\-.+@]/g,
    "",
  );
};

export const getAvatarFromTheme = (theme: Json): string | null => {
  if (
    theme !== null && typeof theme === "object" && "picture" in theme &&
    typeof theme.picture === "string"
  ) {
    return theme.picture as string;
  }
  return null;
};

export const removeNameAccents = (name: string): string => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const getTeam = createTool({
  name: "TEAMS_GET",
  description: "Get a team by slug",
  inputSchema: z.object({
    slug: z.string(),
  }),
  handler: async (props, c) => {
    const { slug } = props;

    await assertTeamResourceAccess(c.tool.name, slug, c);

    const { data: teamData, error } = await c
      .db
      .from("teams")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) throw error;
    if (!teamData) {
      throw new NotFoundError("Team not found or user does not have access");
    }

    return {
      ...teamData,
      avatar_url: getAvatarFromTheme(teamData.theme),
    };
  },
});

export const createTeam = createTool({
  name: "TEAMS_CREATE",
  description: "Create a new team",
  inputSchema: z.object({
    name: z.string(),
    slug: z.string().optional(),
    stripe_subscription_id: z.string().optional(),
  }),

  /**
   * This function handle this steps:
   * 1. check if team slug already exists;
   * 2. If team slug is free ok, procceed, and create team
   * 3. Add user that made the request as team member of team with activity
   * 4. Add member role as onwer (id: 1).
   */
  handler: async (props, c) => {
    c.resourceAccess.grant();

    assertPrincipalIsUser(c);
    const { name, slug, stripe_subscription_id } = props;
    const user = c.user;

    // Enforce unique slug if provided
    if (slug) {
      const { data: existingTeam, error: slugError } = await c
        .db
        .from("teams")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (slugError) throw slugError;
      if (existingTeam) {
        throw new UserInputError("A team with this slug already exists.");
      }
    }

    // Create the team
    const { data: team, error: createError } = await c
      .db
      .from("teams")
      .insert([{ name: sanitizeTeamName(name), slug, stripe_subscription_id }])
      .select()
      .single();

    if (createError) throw createError;

    // Add the creator as an admin member
    const { data: member, error: memberError } = await c
      .db
      .from("members")
      .insert([
        {
          team_id: team.id,
          user_id: user.id,
          activity: [{
            action: "add_member",
            timestamp: new Date().toISOString(),
          }],
        },
      ])
      .select()
      .single();

    if (memberError) {
      await c.db.from("teams").delete().eq("id", team.id);
      throw memberError;
    }

    // Set the member's role_id to 1 in member_roles
    const { error: roleError } = await c
      .db
      .from("member_roles")
      .insert([
        {
          member_id: member.id,
          role_id: OWNER_ROLE_ID,
        },
      ]);

    if (roleError) throw roleError;

    return team;
  },
});

function mergeTheme(
  currentTheme: Json | null,
  newTheme: Theme | undefined,
): Theme | null {
  // If no new theme, return current theme if it's valid
  if (!newTheme) {
    if (
      currentTheme && typeof currentTheme === "object" &&
      !Array.isArray(currentTheme)
    ) {
      const theme = currentTheme as Theme;
      return {
        picture: typeof theme.picture === "string" ? theme.picture : undefined,
        variables:
          typeof theme.variables === "object" && !Array.isArray(theme.variables)
            ? theme.variables
            : undefined,
        font: theme.font,
      };
    }
    return null;
  }

  // Start with current theme if valid
  const merged: Theme = {
    picture: undefined,
    variables: {},
  };

  // Merge current theme if it exists and is valid
  if (
    currentTheme && typeof currentTheme === "object" &&
    !Array.isArray(currentTheme)
  ) {
    const theme = currentTheme as Theme;
    if (typeof theme.picture === "string") {
      merged.picture = theme.picture;
    }
    if (
      typeof theme.variables === "object" && !Array.isArray(theme.variables)
    ) {
      merged.variables = { ...theme.variables };
    }
    if (theme.font) {
      merged.font = theme.font;
    }
  }

  // Merge new theme
  if (newTheme.picture) {
    merged.picture = newTheme.picture;
  }
  if (newTheme.variables) {
    merged.variables = {
      ...merged.variables,
      ...newTheme.variables,
    };
  }
  if (newTheme.font) {
    merged.font = newTheme.font;
  }

  return merged;
}

export const updateTeam = createTool({
  name: "TEAMS_UPDATE",
  description: "Update an existing team",
  inputSchema: z.object({
    id: z.number().describe("The id of the team to update"),
    data: z.object({
      name: z.string().optional(),
      slug: z.string().optional(),
      stripe_subscription_id: z.string().optional(),
      theme: z.object({
        picture: z.string().optional(),
        variables: z.record(z.string()).optional(),
      }).optional(),
    }),
  }),
  handler: async (props, c) => {
    const { id, data } = props;
    console.log(data);

    await assertTeamResourceAccess(c.tool.name, id, c);

    // TODO: check if it's required
    // Enforce unique slug if being updated
    if (data.slug) {
      const { data: existingTeam, error: slugError } = await c
        .db
        .from("teams")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", id)
        .maybeSingle();
      if (slugError) throw slugError;
      if (existingTeam) {
        throw new UserInputError("A team with this slug already exists.");
      }
    }

    // Get current team data to merge theme
    const { data: currentTeam, error: getError } = await c
      .db
      .from("teams")
      .select("theme")
      .eq("id", id)
      .single();

    if (getError) throw getError;

    // Merge themes
    const mergedTheme = mergeTheme(currentTeam.theme, data.theme);

    // Update the team
    const { data: updatedTeam, error: updateError } = await c
      .db
      .from("teams")
      .update({
        ...data,
        ...(data.name ? { name: sanitizeTeamName(data.name) } : {}),
        ...(mergedTheme ? { theme: mergedTheme as Json } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return {
      ...updatedTeam,
      avatar_url: getAvatarFromTheme(updatedTeam.theme),
    };
  },
});

export const deleteTeam = createTool({
  name: "TEAMS_DELETE",
  description: "Delete a team by id",
  inputSchema: z.object({
    teamId: z.number(),
  }),
  handler: async (props, c) => {
    const { teamId } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    const members = await c.db
      .from("members")
      .select("id")
      .eq("team_id", teamId);

    const memberIds = members.data?.map((member) => Number(member.id));

    if (!memberIds) {
      return { data: null, error: "No members found" };
    }

    // TODO: delete roles, policies and role_policy
    await c.db.from("member_roles").delete().in("member_id", memberIds);
    await c.db.from("members").delete().eq("team_id", teamId);

    const { error } = await c.db.from("teams").delete().eq(
      "id",
      teamId,
    )
      .select("id");

    if (error) throw error;
    return { success: true };
  },
});

export const listTeams = createTool({
  name: "TEAMS_LIST",
  description: "List teams for the current user",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    c.resourceAccess.grant();

    assertPrincipalIsUser(c);
    const user = c.user;

    const { data, error } = await c
      .db
      .from("teams")
      .select(`
        id,
        name,
        slug,
        theme,
        created_at,
        members!inner (
          id,
          user_id,
          admin
        )
      `)
      .eq("members.user_id", user.id)
      .is("members.deleted_at", null);

    if (error) {
      console.error(error);
      throw error;
    }

    return data.map(({ members: _members, ...teamData }) => ({
      ...teamData,
      avatar_url: getAvatarFromTheme(teamData.theme),
    }));
  },
});

export const getWorkspaceTheme = createTool({
  name: "TEAMS_GET_THEME",
  description: "Get the theme for a workspace",
  inputSchema: z.object({
    slug: z.string(),
  }),
  handler: async (props, c) => {
    c.resourceAccess.grant();
    const { slug } = props;

    const { data: team, error } = await c.db.from("teams").select("theme").eq(
      "slug",
      slug,
    ).maybeSingle();

    if (error) throw error;

    const theme = team?.theme;
    return { theme };
  },
});
