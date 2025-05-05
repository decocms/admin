import { z } from "zod";
import { type AppContext, createApiHandler } from "../../utils/context.ts";
import { assertUserHasAccessToTeamById } from "../../auth/assertions.ts";

// Helper function to check if user is admin of a team
async function verifyTeamAdmin(c: AppContext, teamId: number, userId: string) {
  const { data: teamMember, error } = await c
    .get("db")
    .from("members")
    .select("*")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("admin", true)
    .single();

  if (error) throw error;
  if (!teamMember) {
    throw new Error("User does not have admin access to this team");
  }
  return teamMember;
}

export const getTeamMembers = createApiHandler({
  name: "TEAM_MEMBERS_GET",
  description: "Get all members of a team",
  schema: z.object({ teamId: z.number() }),
  handler: async (props, c) => {
    const { teamId } = props;
    const user = c.get("user");

    // First verify the user has access to the team
    await assertUserHasAccessToTeamById(
      { userId: user.id, teamId: props.teamId },
      c,
    );

    // Get all members of the team
    const { data, error } = await c
      .get("db")
      .from("members")
      .select(`
        id,
        user_id,
        admin,
        created_at,
        profiles!inner (
          id,
          name,
          email,
          metadata:users_meta_data_view(id, raw_user_meta_data)
        )
      `)
      .eq("team_id", teamId)
      .is("deleted_at", null);

    if (error) throw error;
    return data;
  },
});

export const addTeamMember = createApiHandler({
  name: "TEAM_MEMBERS_ADD",
  description: "Add a new member to a team",
  schema: z.object({
    teamId: z.number(),
    email: z.string(),
  }),
  handler: async (props, c) => {
    const { teamId, email } = props;
    const user = c.get("user");

    // Verify the user has admin access to the team
    await verifyTeamAdmin(c, teamId, user.id);

    // TODO: add flow to invite user that is not present in system.
    const { data: profile } = await c.get("db").from("profiles").select(
      "user_id",
    ).eq("email", email).single();

    if (!profile) {
      throw new Error("Email not found");
    }

    const { data, error } = await c
      .get("db")
      .from("members")
      .insert([{ user_id: profile.user_id, team_id: teamId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

export const updateTeamMember = createApiHandler({
  name: "TEAM_MEMBERS_UPDATE",
  description: "Update a team member. Usefull for updating admin status.",
  schema: z.object({
    teamId: z.number(),
    memberId: z.number(),
    data: z.object({
      admin: z.boolean().optional(),
      activity: z.array(z.any()).optional(),
    }),
  }),
  handler: async (props, c) => {
    const { teamId, memberId, data } = props;
    const user = c.get("user");

    // Verify the user has admin access to the team
    await verifyTeamAdmin(c, teamId, user.id);

    // Verify the member exists in the team
    const { data: member, error: memberError } = await c
      .get("db")
      .from("members")
      .select("*")
      .eq("id", memberId)
      .eq("team_id", teamId)
      .single();

    if (memberError) throw memberError;
    if (!member) {
      throw new Error("Member not found in this team");
    }

    // Update the member
    const { data: updatedMember, error: updateError } = await c
      .get("db")
      .from("members")
      .update(data)
      .eq("id", memberId)
      .eq("team_id", teamId)
      .select()
      .single();

    if (updateError) throw updateError;
    return updatedMember;
  },
});

export const removeTeamMember = createApiHandler({
  name: "TEAM_MEMBERS_REMOVE",
  description: "Remove a member from a team",
  schema: z.object({
    teamId: z.number(),
    memberId: z.number(),
  }),
  handler: async (props, c) => {
    const { teamId, memberId } = props;
    const user = c.get("user");

    // Verify the user has admin access to the team
    await verifyTeamAdmin(c, teamId, user.id);

    // Verify the member exists in the team
    const { data: member, error: memberError } = await c
      .get("db")
      .from("members")
      .select("*")
      .eq("id", memberId)
      .eq("team_id", teamId)
      .single();

    if (memberError) throw memberError;
    if (!member) {
      throw new Error("Member not found in this team");
    }

    // Don't allow removing the last admin
    if (member.admin) {
      const { data: adminCount, error: countError } = await c
        .get("db")
        .from("members")
        .select("*", { count: "exact" })
        .eq("team_id", teamId)
        .eq("admin", true)
        .is("deleted_at", null);

      if (countError) throw countError;
      if (adminCount.length <= 1) {
        throw new Error("Cannot remove the last admin of the team");
      }
    }

    const { error } = await c
      .get("db")
      .from("members")
      .delete()
      .eq("id", memberId)
      .eq("team_id", teamId);

    if (error) throw error;
    return { success: true };
  },
});
