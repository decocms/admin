import { z } from "zod";
import { createApiHandler } from "../../utils.ts";

export const getProfile = createApiHandler({
  name: "PROFILES_GET",
  description: "Get a profile by id",
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }, _req, db) => {
    const { data, error } = await db.getSupabase()
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Profile not found");
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const createProfile = createApiHandler({
  name: "PROFILES_CREATE",
  description: "Create a new profile",
  schema: z.object({
    user_id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().optional(),
    deco_user_id: z.string().uuid().optional(),
    is_new_user: z.boolean().optional(),
  }),
  handler: async ({ user_id, email, name, deco_user_id, is_new_user }, _req, db) => {
    const { data, error } = await db.getSupabase()
      .from('profiles')
      .insert({
        user_id,
        email,
        name,
        deco_user_id,
        is_new_user,
      })
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

export const updateProfile = createApiHandler({
  name: "PROFILES_UPDATE",
  description: "Update an existing profile",
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    deco_user_id: z.string().uuid().optional(),
    is_new_user: z.boolean().optional(),
  }),
  handler: async ({ id, name, email, deco_user_id, is_new_user }, _req, db) => {
    const { data, error } = await db.getSupabase()
      .from('profiles')
      .update({
        name,
        email,
        deco_user_id,
        is_new_user,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Profile not found");
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const deleteProfile = createApiHandler({
  name: "PROFILES_DELETE",
  description: "Delete a profile by id",
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }, _req, db) => {
    const { error } = await db.getSupabase()
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      content: [{
        type: "text",
        text: "Profile deleted successfully",
      }],
    };
  },
}); 