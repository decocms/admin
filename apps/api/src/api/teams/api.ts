import { z } from "zod";
import { createApiHandler } from "../../utils/context.ts";
import { assertUserIsTeamAdmin } from "../../auth/assertions.ts";

const OWNER_ROLE_ID = 1;

export const getTeam = createApiHandler({
  name: "TEAMS_GET",
  description: "Get a team by slug",
  schema: z.object({
    slug: z.string(),
  }),
  handler: async (props, c) => {
    const { slug } = props;
    const user = c.get("user");

    await assertUserIsTeamAdmin(c, slug, user.id);

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
  /**
   * This function handle this steps:
   * 1. check if team slug already exists;
   * 2. If team slug is free ok, procceed, and create team
   * 3. Add user that made the request as team member of team with activity
   * 4. Add member role as onwer (id: 1).
   */
  handler: async (props, c) => {
    const { name, slug, stripe_subscription_id } = props;
    const user = c.get("user");

    // Enforce unique slug if provided
    if (slug) {
      const { data: existingTeam, error: slugError } = await c
        .get("db")
        .from("teams")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (slugError) throw slugError;
      if (existingTeam) {
        throw new Error("A team with this slug already exists.");
      }
    }

    // Create the team
    const { data: team, error: createError } = await c
      .get("db")
      .from("teams")
      .insert([{ name, slug, stripe_subscription_id }])
      .select()
      .single();

    if (createError) throw createError;

    // Add the creator as an admin member
    const { data: member, error: memberError } = await c
      .get("db")
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
      await c.get("db").from("teams").delete().eq("id", team.id);
      throw memberError;
    }

    // Set the member's role_id to 1 in member_roles
    const { error: roleError } = await c
      .get("db")
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

export const updateTeam = createApiHandler({
  name: "TEAMS_UPDATE",
  description: "Update an existing team",
  schema: z.object({
    id: z.number(),
    data: z.object({
      name: z.string().optional(),
      slug: z.string(),
      stripe_subscription_id: z.string().optional(),
    }),
  }),
  handler: async (props, c) => {
    const { id, data } = props;
    const user = c.get("user");

    // First verify the user has admin access to the team
    await assertUserIsTeamAdmin(c, id, user.id);

    // TODO: check if it's required
    // Enforce unique slug if being updated
    if (data.slug) {
      const { data: existingTeam, error: slugError } = await c
        .get("db")
        .from("teams")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", id)
        .maybeSingle();
      if (slugError) throw slugError;
      if (existingTeam) {
        throw new Error("A team with this slug already exists.");
      }
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

    // First verify the user has admin access to the team
    await assertUserIsTeamAdmin(c, teamId, user.id);

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
