import { callFunction, inspect } from "@deco/cf-sandbox";
import z from "zod/v3";
import { formatIntegrationId, WellKnownMcpGroups } from "../../crud/groups.ts";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import {
  AppContext,
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  createMCPToolsStub,
  createToolGroup,
  DeconfigClient,
  MCPClient,
  PROJECT_TOOLS,
  WithTool,
} from "../index.ts";
import {
  createDetailViewUrl,
  createViewImplementation,
  createViewRenderer,
} from "../views-v2/index.ts";
import { DetailViewRenderInputSchema } from "../views-v2/schemas.ts";
import {
  TOOL_CREATE_PROMPT,
  TOOL_DELETE_PROMPT,
  TOOL_READ_PROMPT,
  TOOL_SEARCH_PROMPT,
  TOOL_UPDATE_PROMPT,
} from "./prompts.ts";
import { ToolDefinitionSchema } from "./schemas.ts";
import {
  asEnv,
  evalCodeAndReturnDefaultHandle,
  validate,
  validateExecuteCode,
} from "./utils.ts";

/**
 * Execute tool code without validation
 * This is useful when you want to skip JSON schema validation (e.g., when validation is done at the MCP layer)
 */
export async function executeTool(
  tool: z.infer<typeof ToolDefinitionSchema>,
  input: Record<string, unknown>,
  context: WithTool<AppContext>,
  authorization?: string,
) {
  assertHasWorkspace(context);
  await assertWorkspaceResourceAccess(context);

  const runtimeId = context.locator?.value ?? "default";
  const client = MCPClient.forContext(context);
  const env = asEnv(client, {
    authorization: authorization,
    workspace: context.workspace.value,
    dependencies: tool.dependencies,
  });

  // Use the inlined function code
  using evaluation = await evalCodeAndReturnDefaultHandle(
    tool.execute,
    runtimeId,
  );
  const { ctx, defaultHandle, guestConsole } = evaluation;

  try {
    // Call the function using the callFunction utility
    const callHandle = await callFunction(
      ctx,
      defaultHandle,
      undefined,
      input,
      { env },
    );

    const callResult = ctx.dump(ctx.unwrapResult(callHandle));
    return { result: callResult, logs: guestConsole.logs };
  } catch (error) {
    return { error: inspect(error), logs: guestConsole.logs };
  }
}

/**
 * Validate tool JavaScript/TypeScript syntax (code structure and export)
 */
export async function validateToolSyntax(
  tool: z.infer<typeof ToolDefinitionSchema>,
  runtimeId: string = "default",
): Promise<{ valid: boolean; error?: string }> {
  const validation = await validateExecuteCode(
    tool.execute,
    runtimeId,
    tool.name,
  );

  if (!validation.success) {
    return {
      valid: false,
      error: `JavaScript syntax validation failed: ${validation.error}`,
    };
  }

  return { valid: true };
}

/**
 * Validate tool framework syntax (dependencies, integrations and tools)
 */
export async function validateToolFrameworkSyntax(
  tool: z.infer<typeof ToolDefinitionSchema>,
  context: AppContext,
): Promise<{ valid: boolean; error?: string }> {
  // Validate dependencies if provided
  if (tool.dependencies && tool.dependencies.length > 0) {
    // Create an MCPClientStub to call INTEGRATIONS_LIST
    const client = createMCPToolsStub({
      tools: PROJECT_TOOLS,
      context,
    });

    const result = await client.INTEGRATIONS_LIST({});
    const integrations = result.items;

    for (const dependency of tool.dependencies) {
      // Check if integration exists
      const integration = integrations.find(
        (item: { id: string; name: string; description?: string }) =>
          item.id === dependency.integrationId,
      );

      if (!integration) {
        return {
          valid: false,
          error: `Dependency validation failed: Integration '${dependency.integrationId}' not found. Use READ_MCP to check if the integration exists.`,
        };
      }

      // Validate each tool name exists in the integration
      for (const toolName of dependency.toolNames) {
        const tool = integration.tools?.find(
          (t: { name: string }) => t.name === toolName,
        );

        if (!tool) {
          return {
            valid: false,
            error: `Dependency validation failed: Tool '${toolName}' not found in integration '${integration.name}' (${dependency.integrationId}). Use READ_MCP to see available tools for this integration.`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Execute tool with input/output JSON schema validation
 */
export async function executeToolWithValidation(
  tool: z.infer<typeof ToolDefinitionSchema>,
  input: Record<string, unknown>,
  context: WithTool<AppContext>,
  authorization?: string,
) {
  // Validate input against the tool's input schema
  const inputValidation = validate(input, tool.inputSchema);
  if (!inputValidation.valid) {
    return {
      error: `Input validation failed: ${inspect(inputValidation)}`,
    };
  }

  // Execute the tool
  const result = await executeTool(tool, input, context, authorization);

  // If there was an error during execution, return it as-is
  if (result.error) {
    return result;
  }

  // Validate output against the tool's output schema
  const outputValidation = validate(result.result, tool.outputSchema);
  if (!outputValidation.valid) {
    return {
      error: `Output validation failed: ${inspect(outputValidation)}`,
      logs: result.logs,
    };
  }

  return result;
}

const createToolManagementTool = createToolGroup("Tools", {
  name: "Tools Management",
  description: "Manage your tools",
  icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
});

/**
 * Creates tool binding implementation that accepts a resource reader
 * Returns only the core tool execution functionality
 *
 * This tool is equivalent to calling DECO_RESOURCE_TOOL_CREATE + calling the tool with the input.
 * It creates and executes a tool in a single operation.
 */
export const runTool = createToolManagementTool({
  name: "DECO_TOOL_RUN_TOOL",
  description: TOOL_CREATE_PROMPT,
  inputSchema: z.object({
    tool: ToolDefinitionSchema,
    input: z.object({}).passthrough().describe("The input of the code"),
    authorization: z
      .string()
      .optional()
      .describe("The token to use for the tool execution"),
  }),
  outputSchema: z.object({
    result: z.any().optional().describe("The result of the tool execution"),
    error: z.any().optional().describe("Error if any"),
    logs: z
      .array(
        z.object({
          type: z.enum(["log", "warn", "error"]),
          content: z.string(),
        }),
      )
      .optional()
      .describe("Console logs from the execution"),
  }),
  handler: async ({ tool, input, authorization }, c) => {
    try {
      const runtimeId = c.locator?.value ?? "default";

      // Run both syntax validations in parallel
      const [syntaxValidation, frameworkSyntaxValidation] = await Promise.all([
        validateToolSyntax(tool, runtimeId),
        validateToolFrameworkSyntax(tool, c),
      ]);

      // Check syntax validation results
      if (!syntaxValidation.valid) {
        return { error: syntaxValidation.error };
      }

      if (!frameworkSyntaxValidation.valid) {
        return { error: frameworkSyntaxValidation.error };
      }

      // Execute tool with input/output validation
      return await executeToolWithValidation(tool, input, c, authorization);
    } catch (error) {
      return { error: inspect(error) };
    }
  },
});

/**
 * Tool Resource V2
 *
 * This module provides a Resources 2.0 implementation for tool management
 * using the DeconfigResources 2.0 system with file-based storage.
 *
 * Key Features:
 * - File-based tool storage in DECONFIG directories
 * - Resources 2.0 standardized schemas and URI format
 * - Type-safe tool definitions with Zod validation
 * - Full CRUD operations for tool management
 * - Integration with existing execution environment
 *
 * Usage:
 * - Tools are stored as JSON files in /src/tools directory
 * - Each tool has a unique ID and follows Resources 2.0 URI format
 * - Full validation of tool definitions against existing schemas
 * - Support for inline code only
 */

// Create the ToolResourceV2 using DeconfigResources 2.0
export const ToolResourceV2 = DeconfigResourceV2.define({
  directory: "/src/tools",
  resourceName: "tool",
  group: WellKnownMcpGroups.Tools,
  dataSchema: ToolDefinitionSchema,
  enhancements: {
    DECO_RESOURCE_TOOL_SEARCH: {
      description: TOOL_SEARCH_PROMPT,
    },
    DECO_RESOURCE_TOOL_READ: {
      description: TOOL_READ_PROMPT,
    },
    DECO_RESOURCE_TOOL_CREATE: {
      description: TOOL_CREATE_PROMPT,
    },
    DECO_RESOURCE_TOOL_UPDATE: {
      description: TOOL_UPDATE_PROMPT,
    },
    DECO_RESOURCE_TOOL_DELETE: {
      description: TOOL_DELETE_PROMPT,
    },
  },
  validate: async (tool, context, _deconfig) => {
    const runtimeId = context.locator?.value ?? "default";

    // Run both syntax validations in parallel
    const [syntaxValidation, frameworkSyntaxValidation] = await Promise.all([
      validateToolSyntax(tool, runtimeId),
      validateToolFrameworkSyntax(tool, context),
    ]);

    // Check syntax validation results
    if (!syntaxValidation.valid) {
      throw new Error(syntaxValidation.error);
    }

    if (!frameworkSyntaxValidation.valid) {
      throw new Error(frameworkSyntaxValidation.error);
    }
  },
});

// Export types for TypeScript usage
export type ToolDataV2 = z.infer<typeof ToolDefinitionSchema>;

// Helper function to create a tool resource implementation
export function createToolResourceV2Implementation(
  deconfig: DeconfigClient,
  integrationId: string,
) {
  return ToolResourceV2.create(deconfig, integrationId);
}

/**
 * Creates Views 2.0 implementation for tool views
 *
 * This function creates a complete Views 2.0 implementation that includes:
 * - Resources 2.0 CRUD operations for views
 * - View render operations for tool-specific views
 * - Resource-centric URL patterns for better organization
 *
 * @returns Views 2.0 implementation for tool views
 */
export function createToolViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.Tools);

  const toolDetailRenderer = createViewRenderer({
    name: "tool_detail",
    title: "Tool Detail",
    description: "View and manage individual tool details",
    icon: "https://example.com/icons/tool-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_TOOL_READ",
      "DECO_RESOURCE_TOOL_UPDATE",
      "DECO_RESOURCE_TOOL_DELETE",
    ],
    prompt: `You are a tool management specialist. You have access to these operations:

- **DECO_RESOURCE_TOOL_SEARCH** - Find tools by name or description
- **DECO_RESOURCE_TOOL_READ** - Read tool definition (metadata, schemas, execute code)
- **DECO_RESOURCE_TOOL_UPDATE** - Modify tool properties, schemas, or code
- **DECO_RESOURCE_TOOL_DELETE** - Remove a tool

**CRITICAL - How to Execute Tools:**
To execute tools, ALWAYS use the **i:self** integration:
\`await ctx.env['i:self'].TOOL_NAME({ params })\`

Do NOT use DECO_TOOL_RUN_TOOL. The i:self integration is the preferred and correct way to call tools.

Always confirm before making destructive changes (update/delete).`,
    handler: (input, _c) => {
      const url = createDetailViewUrl("tool", integrationId, input.resource);
      return Promise.resolve({ url });
    },
  });

  // Create Views 2.0 implementation
  const viewsV2Implementation = createViewImplementation({
    renderers: [toolDetailRenderer],
  });

  return viewsV2Implementation;
}
