import { z } from "zod";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createTool } from "../context.ts";

interface PromptRow {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export const createPrompt = createTool({
  name: "PROMPTS_CREATE",
  description: "Create a new prompt",
  inputSchema: z.object({
    name: z.string(),
    description: z.string().optional(),
    content: z.string(),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { name, description, content } = props;

    // @ts-expect-error - TODO: add prompts table
    const { data, error } = await c
      .db
      // @ts-expect-error - TODO: add prompts table
      .from("prompts")
      .insert({
        workspace,
        name,
        content,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  },
});

export const updatePrompt = createTool({
  name: "PROMPTS_UPDATE",
  description: "Update an existing prompt",
  inputSchema: z.object({
    id: z.string(),
    data: z.object({
      name: z.string().optional(),
      description: z.string().optional().nullable(),
      content: z.string().optional(),
    }),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { id, data } = props;

    // @ts-expect-error - TODO: add prompts table
    const { data: prompt, error } = await c.db
      // @ts-expect-error - TODO: add prompts table
      .from("prompts")
      .update(data)
      .eq("id", id)
      .eq("workspace", workspace)
      .select("*")
      .single();

    if (error) throw error;

    return prompt;
  },
});

export const deletePrompt = createTool({
  name: "PROMPTS_DELETE",
  description: "Delete a prompt by id",
  inputSchema: z.object({
    id: z.string(),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { id } = props;

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { error } = await c.db
      // @ts-expect-error - TODO: add prompts table
      .from("prompts")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) throw error;

    return { success: true };
  },
});

export const listPrompts = createTool({
  name: "PROMPTS_LIST",
  description: "List prompts for the current workspace",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    c.resourceAccess.grant();

    await assertWorkspaceResourceAccess(c.tool.name, c);

    // @ts-expect-error - TODO: add prompts table
    const { data, error } = await c.db
      // @ts-expect-error - TODO: add prompts table
      .from("prompts")
      .select("*")
      .eq("workspace", workspace);

    if (error) throw error;

    return data;
  },
});

export const getPrompt = createTool({
  name: "PROMPTS_GET",
  description: "Get a prompt by id",
  inputSchema: z.object({
    id: z.string(),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { id } = props;

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { data, error } = await c
      // @ts-expect-error - TODO: add prompts table
      .from("prompts")
      .select("*")
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (error) throw error;

    return data;
  },
});

export const searchPrompts = createTool({
  name: "PROMPTS_SEARCH",
  description: "Search for prompts",
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const { query, limit = 10, offset = 0 } = props;

    const { data, error } = await c.db
      // @ts-expect-error - TODO: add prompts table
      .from("prompts")
      .select("*")
      .eq("workspace", workspace)
      .textSearch("name", query)
      .range(offset * limit, (offset + 1) * limit);

    if (error) throw error;

    return data;
  },
});
