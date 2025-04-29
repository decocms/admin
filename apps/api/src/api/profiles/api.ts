import { z } from "zod";
import { assertHasUser } from "../../auth/assertions.ts";
import { createApiHandler } from "../../utils/context.ts";
import { enrichUser } from "../../user/index.ts";

export const getProfile = createApiHandler({
  name: "PROFILES_GET",
  description: "Get the current user's profile",
  schema: z.object({}),
  handler: (_, c) => {
    const user = c.get("user");

    assertHasUser(c);

    // TODO: change profile data to have necessary info
    // const { data } = await c.get("db")
    // .from("profiles")
    // .select("*")
    // .eq("user_id", user.id)
    // .single();

    const enrichedUser = enrichUser(user);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(enrichedUser),
      }],
    };
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
    const user = c.get("user");

    assertHasUser(c);

    const { data, error } = await c.get("db")
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
