import { z } from "zod";
import { InternalServerError, NotFoundError } from "../../errors.ts";
import { assertHasUser } from "../assertions.ts";
import { createApiHandler } from "../context.ts";
import { userFromDatabase } from "../user.ts";

export const getProfile = createApiHandler({
  name: "PROFILES_GET",
  description: "Get the current user's profile",
  schema: z.object({}),
  handler: async (_, c) => {
    const user = c.user;

    assertHasUser(c);

    // TODO: change profile data to have necessary info
    const { data, error } = await c.db
      .from("profiles")
      .select(`
        id:user_id,
        name,
        email,
        metadata:users_meta_data_view(id, raw_user_meta_data)
      `)
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // @ts-expect-error - Supabase user metadata is not typed
    return userFromDatabase(data);
  },
});

export const updateProfile = createApiHandler({
  name: "PROFILES_UPDATE",
  description: "Update the current user's profile",
  schema: z.object({
    name: z.string().nullable().optional(),
    email: z.string().optional(),
    deco_user_id: z.number().nullable().optional(),
    is_new_user: z.boolean().nullable().optional(),
  }),
  handler: async (
    { name, email, deco_user_id, is_new_user },
    c,
  ) => {
    const user = c.user;

    assertHasUser(c);

    const { data, error } = await c.db
      .from("profiles")
      .update({
        name,
        email,
        deco_user_id,
        is_new_user,
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!data) {
      throw new NotFoundError("Profile not found");
    }

    return data;
  },
});
