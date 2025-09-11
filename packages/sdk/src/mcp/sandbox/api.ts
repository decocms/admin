import { createSandboxRuntime } from "@deco/cf-sandbox";
import { ValidationError, Validator } from "jsonschema";
import z from "zod";
import { createToolGroup } from "../context.ts";

// Cache for compiled validators
const validatorCache = new Map<string, Validator>();

function validate(instance: unknown, schema: Record<string, unknown>) {
  const schemaKey = JSON.stringify(schema);
  let validator = validatorCache.get(schemaKey);

  if (!validator) {
    validator = new Validator();
    validator.addSchema(schema);

    validatorCache.set(schemaKey, validator);
  }

  return validator.validate(instance, schema);
}

export const createTool = createToolGroup("Sandbox", {
  name: "Code Sandbox",
  description: "Run JavaScript code",
  icon:
    "https://assets.decocache.com/mcp/de7e81f6-bf2b-4bf5-a96c-867682f7d2ca/Team--User-Management.png",
});

export const runScript = createTool({
  name: "SANDBOX_RUN_SCRIPT",
  description: "Javascript code to run in a sandbox",
  inputSchema: z.object({ code: z.string() }),
  outputSchema: z.object({
    result: z.any().optional(),
    error: z.any().optional(),
    logs: z.array(
      z.object({ type: z.enum(["log", "warn", "error"]), content: z.string() }),
    ),
  }),
  handler: async ({ code }, c) => {
    c.resourceAccess.grant();
    // await assertWorkspaceResourceAccess(c);

    const tenantId = c.locator?.value ?? "default";

    try {
      const runtime = await createSandboxRuntime(tenantId, {
        memoryLimitBytes: 64 * 1024 * 1024, // 64MB
        stackSizeBytes: 1 << 20, // 1MB,
      });

      const ctx = runtime.createContext({ interruptAfterMs: 100 });
      const fn = ctx.createFunction(code);
      const result = await fn();

      // keep runtime warm for this tenant; do not dispose here
      if (result.error) {
        return { error: result.error, logs: result.logs };
      }
      return { result: result.value, logs: result.logs };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        logs: [],
      };
    }
  },
});

const SANDBOX_CREATE_TOOL_DESCRIPTION =
  `Create a new tool in the sandbox with JSON Schema validation.
example, create a greeting tool pass the following arguments:

{
  name: "Greeting",
  description: "Greet the user",
  inputSchema: {
    "type": "object",
    "properties": {
      "name": { "type": "string" }
    },
    "required": ["name"]
  },
  outputSchema: {
    "type": "object",
    "properties": {
      "greeting": { "type": "string" }
    },
    "required": ["greeting"]
  },
  execute: "async (inputSchema, ctx) => ({ greeting: "Hello, " + inputSchema.name });"    // this is the function body
}

The execute has this exact signature:
async (inputSchema: typeof inputSchema, ctx: unknown): Promise<typeof outputSchema> => {}

Note: Both inputSchema and outputSchema must be valid JSON Schema objects. Input and output data will be validated against these schemas when the tool is created and executed.
`;

const ToolDefinitionSchema = z.object({
  name: z.string().describe("The name of the tool"),
  description: z.string().describe("The description of the tool"),
  inputSchema: z
    .object({})
    .passthrough()
    .describe("The JSON schema of the input of the tool"),
  outputSchema: z
    .object({})
    .passthrough()
    .describe("The JSON schema of the output of the tool"),
  execute: z
    .string()
    .describe("The JavaScript function to execute when the tool is called"),
});

const store = new Map<string, z.infer<typeof ToolDefinitionSchema>>();

export const sandboxCreateTool = createTool({
  name: "SANDBOX_UPSERT_TOOL",
  description: SANDBOX_CREATE_TOOL_DESCRIPTION,
  inputSchema: ToolDefinitionSchema,
  outputSchema: z.object({
    message: z.string().describe("The message of the tool"),
    error: z.string().optional().describe("Compilation error if any"),
  }),
  handler: async (
    { name, description, inputSchema, outputSchema, execute },
    c,
  ) => {
    c.resourceAccess.grant();
    // await assertWorkspaceResourceAccess(c);

    const tenantId = c.locator?.value ?? "default";

    try {
      // Create a sandbox runtime to validate the function
      const runtime = await createSandboxRuntime(tenantId, {
        memoryLimitBytes: 64 * 1024 * 1024, // 64MB
        stackSizeBytes: 1 << 20, // 1MB,
      });

      const ctx = runtime.createContext({ interruptAfterMs: 100 });

      // Validate the function by creating it (this will compile and validate syntax)
      ctx.createFunction(
        "inputSchema",
        "ctx",
        `return (${execute})(inputSchema, ctx);`,
      );

      // Store the tool if validation passes
      store.set(name, {
        name,
        description,
        inputSchema,
        outputSchema,
        execute,
      });

      return { message: "Tool created and validated successfully" };
    } catch (error) {
      return {
        message: "Tool creation failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

export const getTool = createTool({
  name: "SANDBOX_GET_TOOL",
  description: "Get a tool from the sandbox",
  inputSchema: z.object({ name: z.string().describe("The name of the tool") }),
  outputSchema: z.object({
    tool: ToolDefinitionSchema.optional().describe(
      "The tool definition if found",
    ),
    found: z.boolean().describe("Whether the tool was found"),
  }),
  handler: ({ name }, c) => {
    c.resourceAccess.grant();
    // await assertWorkspaceResourceAccess(c);

    const tool = store.get(name);
    return {
      tool: tool || undefined,
      found: !!tool,
    };
  },
});

export const deleteTool = createTool({
  name: "SANDBOX_DELETE_TOOL",
  description: "Delete a tool in the sandbox",
  inputSchema: z.object({ name: z.string().describe("The name of the tool") }),
  outputSchema: z.object({
    message: z.string().describe("The message of the tool"),
  }),
  handler: ({ name }, c) => {
    c.resourceAccess.grant();
    // await assertWorkspaceResourceAccess(c);

    store.delete(name);
    return { message: "Tool deleted successfully" };
  },
});

export const sandboxRunTool = createTool({
  name: "SANDBOX_RUN_TOOL",
  description: "Run a tool in the sandbox",
  inputSchema: z.object({
    name: z.string().describe("The name of the tool"),
    input: z.object({}).passthrough().describe("The input of the tool"),
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
  handler: async ({ name, input }, c) => {
    c.resourceAccess.grant();
    // await assertWorkspaceResourceAsccess(c);

    const tool = store.get(name);
    if (!tool) {
      return { error: "Tool not found" };
    }

    const tenantId = c.locator?.value ?? "default";

    try {
      // Validate input against the tool's input schema
      const inputValidation = validate(input, tool.inputSchema);
      if (!inputValidation.valid) {
        return {
          error: `Input validation failed: ${
            inputValidation.errors?.join(", ")
          }`,
          logs: [],
        };
      }

      const runtime = await createSandboxRuntime(tenantId, {
        memoryLimitBytes: 64 * 1024 * 1024, // 64MB
        stackSizeBytes: 1 << 20, // 1MB,
      });

      const ctx = runtime.createContext({ interruptAfterMs: 100 });
      const fn = ctx.createFunction(
        "inputSchema",
        "ctx",
        `return (${tool.execute})(inputSchema, ctx);`,
      );

      const result = await fn(input, {
        env: {
          get: async () => {
            const response = await fetch("https://example.com");
            const data = await response.text();

            return data;
          },
        },
      });

      if (result.error) {
        return { error: result.error, logs: result.logs };
      }

      // Validate output against the tool's output schema
      const outputValidation = validate(result.value, tool.outputSchema);

      if (!outputValidation.valid) {
        return {
          error: `Output validation failed: ${
            outputValidation.errors?.join(", ")
          }`,
          logs: result.logs || [],
        };
      }

      return { result: result.value, logs: result.logs };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

export const sandboxListTools = createTool({
  name: "SANDBOX_LIST_TOOLS",
  description: "List all tools in the sandbox",
  inputSchema: z.object({}),
  outputSchema: z.object({ tools: z.array(ToolDefinitionSchema) }),
  handler: (_, c) => {
    c.resourceAccess.grant();
    // await assertWorkspaceResourceAccess(c);

    return {
      tools: Array.from(store.values()),
    };
  },
});
