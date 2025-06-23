import { z } from "zod";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";

const createTool = createToolGroup("Prompt", {
  name: "Prompt Management",
  description: "Manage reusable prompt templates.",
  icon:
    "https://assets.decocache.com/mcp/9861d914-141d-4236-b616-d73ef6559ca1/Prompt-Management.png",
});

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

    const { data, error } = await c
      .db
      .from("deco_chat_prompts")
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

    const { data: prompt, error } = await c.db
      .from("deco_chat_prompts")
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
      .from("deco_chat_prompts")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) throw error;

    return { success: true };
  },
});

const virtualPromptsFor = (
  workspace: string,
  ids?: string[],
): [
  {
    id: string;
    content: string;
    name: string;
    description: string;
    created_at: string;
  }[],
  string[],
] => {
  const virtualPrompts = [
    {
      content: workspace,
      created_at: new Date().toISOString(),
      description: "The workspace name",
      id: `workspace:${workspace}`,
      name: "workspace",
    },
    {
      content: new Date().toISOString(),
      created_at: new Date().toISOString(),
      description: "The current date and time",
      id: `date:now`,
      name: "now",
    },
  ];
  if (!ids || ids.length === 0) {
    return [virtualPrompts, []];
  }

  return [
    virtualPrompts.filter((p) => ids.includes(p.id)),
    ids.filter((id) => !virtualPrompts.some((p) => p.id === id)),
  ];
};
export const listPrompts = createTool({
  name: "PROMPTS_LIST",
  description: "List prompts for the current workspace",
  inputSchema: z.object({
    ids: z.array(z.string()).optional().describe("Filter prompts by ids"),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { ids = [] } = props;

    const [virtualPrompts, remainingIds] = virtualPromptsFor(workspace, ids);

    let query = c.db
      .from("deco_chat_prompts")
      .select("*")
      .eq("workspace", workspace);

    if (remainingIds.length > 0) {
      query = query.in("id", remainingIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    return [...data, ...virtualPrompts];
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
    const [virtualPrompts, _] = virtualPromptsFor(workspace, [id]);
    const prompt = virtualPrompts[0];
    if (prompt) return prompt;

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { data, error } = await c.db
      .from("deco_chat_prompts")
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

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { query, limit = 10, offset = 0 } = props;

    const { data, error } = await c.db
      .from("deco_chat_prompts")
      .select("*")
      .eq("workspace", workspace)
      .textSearch("name", query)
      .range(offset * limit, (offset + 1) * limit);

    if (error) throw error;

    return data;
  },
});
