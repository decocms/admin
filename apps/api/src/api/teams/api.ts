import { z } from "zod";
import { supabase } from "../../db/client.ts";
import { createApiHandler } from "../../utils/context.ts";

export const getTeam = createApiHandler({
  name: "TEAMS_GET",
  description: "Get a team by id",
  schema: z.object({
    teamId: z.string(),
  }),
  handler: async (props) => {
    const { teamId } = props;
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    if (error) throw error;
    return data;
  },
});

export const createTeam = createApiHandler({
  name: "TEAMS_CREATE",
  description: "Create a new team",
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  handler: async (props) => {
    const { name, description } = props;
    const { data, error } = await supabase
      .from("teams")
      .insert([{ name, description }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

export const updateTeam = createApiHandler({
  name: "TEAMS_UPDATE",
  description: "Update an existing team",
  schema: z.object({
    teamId: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
  handler: async (props) => {
    const { teamId, name, description } = props;
    const { data, error } = await supabase
      .from("teams")
      .update({ name, description })
      .eq("id", teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

export const deleteTeam = createApiHandler({
  name: "TEAMS_DELETE",
  description: "Delete a team by id",
  schema: z.object({
    teamId: z.string(),
  }),
  handler: async (props) => {
    const { teamId } = props;
    const { error } = await supabase
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

    if (!user) {
      throw new Error("Missing user");
    }

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    return data;
  },
});
