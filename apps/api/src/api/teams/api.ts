import { z } from "zod";
import { createApiHandler } from "../../utils/context.ts";

export const getTeam = createApiHandler({
  name: "TEAMS_GET",
  description: "Get a team by slug",
  schema: z.object({
    slug: z.string(),
  }),
  handler: async (props, c) => {
    const { slug } = props;
    const user = c.get("user");

    const { data, error } = await c
      .get("db")
      .from("teams")
      .select(`
        *,
        members!inner (
          id,
          user_id,
          admin
        )
      `)
      .eq("slug", slug)
      .eq("members.user_id", user.id)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Team not found or user does not have access");

    const { members: _members, ...teamData } = data;

    return teamData;
  },
});

export const createTeam = createApiHandler({
  name: "TEAMS_CREATE",
  description: "Create a new team",
  schema: z.object({
    name: z.string(),
    slug: z.string().optional(),
    stripe_subscription_id: z.string().optional(),
  }),
  handler: async (props, c) => {
    const { name, slug, stripe_subscription_id } = props;
    const user = c.get("user");

    // Create the team
    const { data: team, error: createError } = await c
      .get("db")
      .from("teams")
      .insert([{ name, slug, stripe_subscription_id }])
      .select()
      .single();

    if (createError) throw createError;

    // Add the creator as an admin member
    const { error: memberError } = await c
      .get("db")
      .from("members")
      .insert([{
        team_id: team.id,
        user_id: user.id,
        admin: true,
      }]);

    if (memberError) throw memberError;

    return team;
  },
});

export const updateTeam = createApiHandler({
  name: "TEAMS_UPDATE",
  description: "Update an existing team",
  schema: z.object({
    id: z.number(),
    data: z.object({
      name: z.string().optional(),
      slug: z.string().optional(),
      stripe_subscription_id: z.string().optional(),
    }),
  }),
  handler: async (props, c) => {
    const { id, data } = props;
    const user = c.get("user");

    // First verify the user has admin access to the team
    const { data: team, error: teamError } = await c
      .get("db")
      .from("teams")
      .select(`
        *,
        members!inner (
          id,
          user_id,
          admin
        )
      `)
      .eq("id", id)
      .eq("members.user_id", user.id)
      .eq("members.admin", true)
      .single();

    if (teamError) throw teamError;

    if (!team) {
      throw new Error("Team not found or user does not have admin access");
    }

    // Update the team
    const { data: updatedTeam, error: updateError } = await c
      .get("db")
      .from("teams")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return updatedTeam;
  },
});

export const deleteTeam = createApiHandler({
  name: "TEAMS_DELETE",
  description: "Delete a team by id",
  schema: z.object({
    teamId: z.number(),
  }),
  handler: async (props, c) => {
    const { teamId } = props;
    const user = c.get("user");

    // Verify admin access
    const { data: team, error: teamError } = await c
      .get("db")
      .from("teams")
      .select(`
        *,
        members!inner (
          id,
          user_id,
          admin
        )
      `)
      .eq("id", teamId)
      .eq("members.user_id", user.id)
      .eq("members.admin", true)
      .single();

    if (teamError) throw teamError;
    if (!team) {
      throw new Error("Team not found or user does not have admin access");
    }

    const { error } = await c
      .get("db")
      .from("teams")
      .delete()
      .eq("id", teamId);

    if (error) throw error;
    return { success: true };
  },
});

export const listTeams = createApiHandler({
  name: "TEAMS_LIST",
  description: "List teams for the current user",
  schema: z.object({}),
  handler: async (_, c) => {
    const user = c.get("user");

    const { data, error } = await c
      .get("db")
      .from("teams")
      .select(`
        id,
        name,
        slug,
        created_at,
        members!inner (
          id,
          user_id,
          admin
        )
      `)
      .eq("members.user_id", user.id);

    if (error) {
      console.error(error);
      throw error;
    }

    return data.map(({ members: _members, ...teamData }) => teamData);
  },
});
