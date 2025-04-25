import { z } from "zod";
import { supabase } from "../../db/client.ts";
import { createApiHandler } from "../../utils.ts";

export const getTeam = createApiHandler({
  name: "getTeam",
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
  name: "createTeam",
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
  name: "updateTeam",
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
  name: "deleteTeam",
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