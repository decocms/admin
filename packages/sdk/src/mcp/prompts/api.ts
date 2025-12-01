import { z } from "zod";
import { WELL_KNOWN_PROMPT_IDS } from "../../constants.ts";
import { resolveMentions as resolveMentionsFn } from "../../utils/prompt-mentions.ts";
import {
  assertHasLocator,
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";
import { MCPClient } from "../index.ts";
import {
  getProjectIdFromContext,
  workspaceOrProjectIdConditions,
} from "../projects/util.ts";
import { ProjectLocator } from "../../locator.ts";
import { PromptSchema } from "./schemas.ts";

const createTool = createToolGroup("Prompt", {
  name: "Prompt Management",
  description: "Manage reusable prompt templates.",
  icon: "https://assets.decocache.com/mcp/9861d914-141d-4236-b616-d73ef6559ca1/Prompt-Management.png",
});

export const createPrompt = createTool({
  name: "PROMPTS_CREATE",
  description: "Create a new prompt",
  inputSchema: z.lazy(() =>
    z.object({
      name: z.string(),
      description: z.string().optional(),
      content: z.string(),
    }),
  ),
  outputSchema: PromptSchema,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c);
    const projectId = await getProjectIdFromContext(c);

    const { name, description, content } = props;

    const { data, error } = await c.db
      .from("deco_chat_prompts")
      .insert({
        workspace,
        project_id: projectId,
        name,
        content,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    if (!data) throw new Error("Failed to create prompt");
    await c.db
      .from("deco_chat_prompts_versions")
      .insert({
        prompt_id: data.id,
        name: data.name,
        content: data.content,
        created_by: `${c.user.id}`,
      })
      .select()
      .single();

    return data;
  },
});

export const updatePrompt = createTool({
  name: "PROMPTS_UPDATE",
  description: "Update an existing prompt",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
      data: z.object({
        name: z.string().optional(),
        description: z.string().optional().nullable(),
        content: z.string().optional(),
      }),
      versionName: z.string().optional(),
    }),
  ),
  outputSchema: PromptSchema,
  handler: async (props, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const { id, data, versionName } = props;

    const { data: prompt, error } = await c.db
      .from("deco_chat_prompts")
      .update(data)
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c))
      .select("*")
      .single();

    if (error) throw error;

    if (!prompt) throw new Error("Failed to update prompt");

    await c.db
      .from("deco_chat_prompts_versions")
      .insert({
        prompt_id: id,
        name: data.name,
        content: data.content,
        created_by: `${c.user.id}`,
        version_name: versionName,
      })
      .select()
      .single();

    return prompt;
  },
});

export const deletePrompt = createTool({
  name: "PROMPTS_DELETE",
  description: "Delete a prompt by id",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      success: z.boolean().describe("Whether the deletion was successful"),
    }),
  ),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const { id } = props;

    await assertWorkspaceResourceAccess(c);

    const { error } = await c.db
      .from("deco_chat_prompts")
      .delete()
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c));

    if (error) throw error;

    return { success: true };
  },
});

const virtualPromptsFor = (
  locator: ProjectLocator,
  ids?: string[],
): [
  {
    id: string;
    content: string;
    name: string;
    description: string;
    created_at: string;
    readonly: boolean;
  }[],
  string[],
] => {
  const now = new Date().toISOString();
  const virtualPrompts = [
    {
      content: locator,
      created_at: now,
      description: "The locator of the current project",
      id: WELL_KNOWN_PROMPT_IDS.locator,
      name: "locator",
      readonly: true,
    },
    {
      content: now,
      created_at: now,
      description: `The current date and time ${now}`,
      id: WELL_KNOWN_PROMPT_IDS.now,
      name: "now",
      readonly: true,
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
  inputSchema: z.lazy(() =>
    z.object({
      ids: z.array(z.string()).optional().describe("Filter prompts by ids"),
      resolveMentions: z
        .boolean()
        .optional()
        .describe("Resolve mentions in the prompts"),
      excludeIds: z
        .array(z.string())
        .optional()
        .describe("Exclude prompts by ids"),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(PromptSchema),
    }),
  ),
  handler: async (props, c) => {
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const { ids = [], resolveMentions = false, excludeIds = [] } = props;

    const [virtualPrompts, remainingIds] = virtualPromptsFor(
      c.locator.value,
      ids,
    );

    // If the ids filter list contains some id, and after getting the virtual prompts
    // no ids are left, we can return the virtual prompts
    if (ids.length > 0 && remainingIds.length === 0) {
      return { items: virtualPrompts };
    }

    let query = c.db
      .from("deco_chat_prompts")
      .select("*")
      .or(await workspaceOrProjectIdConditions(c));

    if (remainingIds.length > 0) {
      query = query.in("id", remainingIds);
    }

    if (excludeIds.length > 0) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data, error } = await query;

    if (error) throw error;

    let prompts = data;

    if (resolveMentions) {
      const resolvedPrompts = await Promise.allSettled(
        prompts.map((prompt) =>
          resolveMentionsFn(
            prompt.content,
            c.locator.value,
            MCPClient.forContext(c),
          ),
        ),
      );

      prompts = prompts.map((prompt, index) => ({
        ...prompt,
        content:
          resolvedPrompts[index].status === "fulfilled"
            ? resolvedPrompts[index].value
            : prompt.content,
      }));
    }

    return {
      items: [...prompts, ...virtualPrompts],
    };
  },
});

export const getPrompt = createTool({
  name: "PROMPTS_GET",
  description: "Get a prompt by id",
  inputSchema: z.lazy(() =>
    z
      .object({
        id: z.string(),
      })
      .describe("The id of the prompt to get"),
  ),
  outputSchema: z.lazy(() => PromptSchema),
  handler: async (props, c) => {
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const { id } = props;
    const [virtualPrompts, _] = virtualPromptsFor(c.locator.value, [id]);
    const prompt = virtualPrompts[0];
    if (prompt) return prompt;

    const { data, error } = await c.db
      .from("deco_chat_prompts")
      .select("*")
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c))
      .single();

    if (error) throw error;

    return data;
  },
});

export const getPromptVersions = createTool({
  name: "PROMPTS_GET_VERSIONS",
  description: "Get the versions of a prompt",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(
        z.object({
          content: z.string().nullable(),
          created_at: z.string(),
          created_by: z.string().nullable(),
          id: z.string(),
          name: z.string().nullable(),
          prompt_id: z.string(),
          version_name: z.string().nullable(),
        }),
      ),
    }),
  ),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const { id, limit = 50, offset = 0 } = props;

    await assertWorkspaceResourceAccess(c);

    const { data, error } = await c.db
      .from("deco_chat_prompts_versions")
      .select("*")
      .eq("prompt_id", id)
      .order("created_at", { ascending: false })
      .range(offset * limit, (offset + 1) * limit);

    if (error) throw error;

    return {
      items: data,
    };
  },
});

export const renamePromptVersion = createTool({
  name: "PROMPTS_RENAME_VERSION",
  description: "Rename a prompt version",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
      versionName: z.string(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The id of the version"),
      prompt_id: z.string().describe("The id of the prompt"),
      name: z
        .string()
        .nullable()
        .optional()
        .describe("The name of the version"),
      content: z
        .string()
        .nullable()
        .optional()
        .describe("The content of the version"),
      version_name: z
        .string()
        .nullable()
        .optional()
        .describe("The version name"),
      created_by: z
        .string()
        .nullable()
        .optional()
        .describe("The user who created the version"),
      created_at: z
        .string()
        .describe("The date and time the version was created"),
    }),
  ),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const { id, versionName } = props;

    await assertWorkspaceResourceAccess(c);

    const { data, error } = await c.db
      .from("deco_chat_prompts_versions")
      .update({ version_name: versionName })
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c))
      .single();

    if (error) throw error;

    return data;
  },
});
