import { z } from "zod";
import { supabase } from "../../db/client.ts";
import { createApiHandler } from "../../utils.ts";

export const getTeamMember = createApiHandler({
  name: "TEAM_MEMBERS_GET",
  description: "Get a team member by id",
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Team member not found");
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const createTeamMember = createApiHandler({
  name: "TEAM_MEMBERS_CREATE",
  description: "Create a new team member",
  schema: z.object({
    team_id: z.string().uuid(),
    member_id: z.string().uuid(),
    role: z.string(),
  }),
  handler: async ({ team_id, member_id, role }) => {
    const { data, error } = await supabase
      .from("team_members")
      .insert({ team_id, member_id, role })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const updateTeamMember = createApiHandler({
  name: "TEAM_MEMBERS_UPDATE",
  description: "Update a team member",
  schema: z.object({
    id: z.string().uuid(),
    role: z.string().optional(),
  }),
  handler: async ({ id, role }) => {
    const { data, error } = await supabase
      .from("team_members")
      .update({ role })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Team member not found");
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const deleteTeamMember = createApiHandler({
  name: "TEAM_MEMBERS_DELETE",
  description: "Delete a team member",
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }) => {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      content: [{
        type: "text",
        text: "Team member deleted successfully",
      }],
    };
  },
});
