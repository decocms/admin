import { MemberSchema } from "@deco/sdk";
import { z } from "zod";
import { createApiHandler } from "../../utils.ts";

export const getMember = createApiHandler({
  name: "MEMBERS_GET",
  description: "Get a member by id",
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }, _req, db) => {
    const { data, error } = await db.getSupabase()
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Member not found");
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const createMember = createApiHandler({
  name: "MEMBERS_CREATE",
  description: "Create a new member",
  schema: z.object({ member: MemberSchema }),
  handler: async ({ member }, _req, db) => {
    const { data, error } = await db.getSupabase()
      .from('members')
      .insert(member)
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

export const updateMember = createApiHandler({
  name: "MEMBERS_UPDATE",
  description: "Update an existing member",
  schema: z.object({ id: z.string().uuid(), member: MemberSchema }),
  handler: async ({ id, member }, _req, db) => {
    const { data, error } = await db.getSupabase()
      .from('members')
      .update(member)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Member not found");
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const deleteMember = createApiHandler({
  name: "MEMBERS_DELETE",
  description: "Delete a member by id",
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }, _req, db) => {
    const { error } = await db.getSupabase()
      .from('members')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      content: [{
        type: "text",
        text: "Member deleted successfully",
      }],
    };
  },
}); 