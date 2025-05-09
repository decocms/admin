import { z } from "zod";
import {
  assertUserHasAccessToTeamById,
  assertUserIsTeamAdmin,
} from "../../auth/assertions.ts";
import { type AppContext, createApiHandler } from "../../utils/context.ts";
import { userFromDatabase } from "../../utils/user.ts";

const getTeamAdmin = async (c: AppContext, teamId: number) =>
  await c
    .get("db")
    .from("members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

export const updateActivityLog = async (c: AppContext, {
  teamId,
  userId,
  action,
}: {
  teamId: number;
  userId: string;
  action: "add_member" | "remove_member";
}) => {
  const currentTimestamp = new Date().toISOString();
  const { data } = await c.get("db")
    .from("members")
    .select("activity")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .single();

  const activityLog = data?.activity || [];

  return await c.get("db")
    .from("members")
    .update({
      activity: [...activityLog, {
        action,
        timestamp: currentTimestamp,
      }],
    })
    .eq("team_id", teamId)
    .eq("user_id", userId);
};

interface DbMember {
  id: number;
  user_id: string | null;
  admin: boolean | null;
  created_at: string | null;
  profiles: {
    /** @description is user id */
    id: string;
    name: string | null;
    email: string;
    metadata: {
      id: string | null;
      // deno-lint-ignore no-explicit-any
      raw_user_meta_data: any;
    };
  };
}

const mapMember = (
  member: DbMember,
  admin?: Pick<DbMember, "user_id"> | null,
) => ({
  ...member,
  // @ts-expect-error - Supabase user metadata is not typed
  profiles: userFromDatabase(member.profiles),
  admin: member.user_id === admin?.user_id,
});

export const getTeamMembers = createApiHandler({
  name: "TEAM_MEMBERS_GET",
  description: "Get all members of a team",
  schema: z.object({
    teamId: z.number(),
    withActivity: z.boolean().optional(),
  }),
  handler: async (props, c) => {
    const { teamId, withActivity } = props;
    const user = c.get("user");

    // First verify the user has access to the team
    await assertUserHasAccessToTeamById(
      { userId: user.id, teamId: props.teamId },
      c,
    );

    // Get all members of the team
    const [{ data, error }, { data: teamAdminMember }] = await Promise.all([
      c
        .get("db")
        .from("members")
        .select(`
        id,
        user_id,
        admin,
        created_at,
        profiles!inner (
          id:user_id,
          name,
          email,
          metadata:users_meta_data_view(id, raw_user_meta_data)
        )
      `)
        .eq("team_id", teamId)
        .is("deleted_at", null),
      getTeamAdmin(c, teamId),
    ]);

    if (error) throw error;

    const members = data.map((member) => mapMember(member, teamAdminMember));

    let activityByUserId: Record<string, string> = {};

    if (withActivity) {
      const { data: activityData } = await c.get("db").rpc(
        "get_latest_user_activity",
        {
          p_resource: "team",
          p_key: "id",
          p_value: `${teamId}`,
        },
      ).select("user_id, created_at");

      if (activityData) {
        activityByUserId = activityData.reduce((res, activity) => {
          res[activity.user_id] = activity.created_at;
          return res;
        }, {} as Record<string, string>);
      }

      return members.map((member) => ({
        ...member,
        lastActivity: activityByUserId[member.user_id ?? ""],
      }));
    }

    return members;
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
    await assertUserIsTeamAdmin(c, teamId, user.id);

    // TODO: add flow to invite user that is not present in system.
    const { data: profile } = await c.get("db").from("profiles").select(
      "user_id",
    ).eq("email", email).single();

    if (!profile) {
      throw new Error("Email not found");
    }

    const { data: alreadyMember } = await c.get("db").from("members").select(
      "id",
    ).eq(
      "team_id",
      teamId,
    ).eq("user_id", profile.user_id).maybeSingle();

    const { data, error } = await c
      .get("db")
      .from("members")
      .upsert([{
        ...(alreadyMember?.id
          ? {
            id: alreadyMember.id,
          }
          : {}),
        user_id: profile.user_id,
        team_id: teamId,
        deleted_at: null,
      }])
      .select(`
        id,
        user_id,
        admin,
        created_at,
        profiles!inner (
          id:user_id,
          name,
          email,
          metadata:users_meta_data_view(id, raw_user_meta_data)
        )
      `)
      .single();

    await updateActivityLog(c, {
      teamId,
      userId: profile.user_id,
      action: "add_member",
    });

    if (error) throw error;
    return mapMember(data);
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
    }),
  }),
  handler: async (props, c) => {
    const { teamId, memberId, data } = props;
    const user = c.get("user");

    // Verify the user has admin access to the team
    await assertUserIsTeamAdmin(c, teamId, user.id);

    // Verify the member exists in the team
    const { data: member, error: memberError } = await c
      .get("db")
      .from("members")
      .select("id")
      .eq("id", memberId)
      .eq("team_id", teamId)
      .is("deleted_at", null)
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
    await assertUserIsTeamAdmin(c, teamId, user.id);

    // Verify the member exists in the team
    const { data: member, error: memberError } = await c
      .get("db")
      .from("members")
      .select("id, admin, user_id")
      .eq("id", memberId)
      .eq("team_id", teamId)
      .is("deleted_at", null)
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

    const currentTimestamp = new Date();
    const { error } = await c
      .get("db")
      .from("members")
      .update({
        deleted_at: currentTimestamp.toISOString(),
      })
      .eq("team_id", teamId)
      .eq("user_id", member.user_id!);

    await updateActivityLog(c, {
      teamId,
      userId: member.user_id!,
      action: "remove_member",
    });

    if (error) throw error;
    return { success: true };
  },
});

export const registerMemberActivity = createApiHandler({
  name: "TEAM_MEMBER_ACTIVITY_REGISTER",
  description: "Remove a member from a team",
  schema: z.object({
    teamId: z.number(),
  }),
  handler: async (props, c) => {
    const { teamId } = props;
    const user = c.get("user");

    // Verify the user has admin access to the team
    await assertUserHasAccessToTeamById({
      teamId,
      userId: user.id,
    }, c);

    await c.get("db").from("user_activity").insert({
      user_id: user.id,
      resource: "team",
      key: "id",
      value: `${teamId}`,
    });

    return { success: true };
  },
});
