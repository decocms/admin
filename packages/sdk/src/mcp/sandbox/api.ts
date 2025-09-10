import { createSandboxRuntime, Scope } from "@deco/cf-sandbox";
import z from "zod";
import { assertWorkspaceResourceAccess } from "../assertions.ts";
import { createToolGroup } from "../context.ts";

export const createTool = createToolGroup("Sandbox", {
  name: "Code Sandbox",
  description: "Run JavaScript code",
  icon: "https://assets.decocache.com/mcp/de7e81f6-bf2b-4bf5-a96c-867682f7d2ca/Team--User-Management.png",
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

const SANDBOX_CREATE_TOOL_DESCRIPTION = `Create a new tool in the sandbox.
example, create a greeting tool pass the following arguments:

{
  name: "Greeting",
  description: "Greet the user",
  inputSchema: {
    name: "string",
  },
  outputSchema: {
    greeting: "string",
  },
  functionBody: "return { greeting: "Hello, " + inputSchema.name };"    // this is the function body
}

The function body will always receive the following arguments:
(inputSchema, ctx)

`;

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema: any;
  functionBody: string;
}

const store = new Map<string, ToolDefinition>();

export const sandboxCreateTool = createTool({
  name: "SANDBOX_CREATE_TOOL",
  description: SANDBOX_CREATE_TOOL_DESCRIPTION,
  inputSchema: z.object({
    name: z.string().describe("The name of the tool"),
    description: z
      .string()
      .describe(
        "Description of how to use the tool. Also, add some examples of what are the expected inputs and outputs when calling this tool.",
      ),
    inputSchema: z
      .object({})
      .passthrough()
      .describe("The JSON schema of the input of the tool"),
    outputSchema: z
      .object({})
      .passthrough()
      .describe("The JSON schema of the output of the tool"),
    functionBody: z
      .string()
      .describe(
        "The JavaScript code that will be executed when the tool is called",
      ),
  }),
  outputSchema: z.object({
    message: z.string().describe("The message of the tool"),
    error: z.string().optional().describe("Compilation error if any"),
  }),
  handler: async (
    { name, description, inputSchema, outputSchema, functionBody },
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
      ctx.createFunction("inputSchema", "ctx", functionBody);

      // Store the tool if validation passes
      store.set(name, {
        name,
        description,
        inputSchema,
        outputSchema,
        functionBody,
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
      const runtime = await createSandboxRuntime(tenantId, {
        memoryLimitBytes: 64 * 1024 * 1024, // 64MB
        stackSizeBytes: 1 << 20, // 1MB,
      });

      const ctx = runtime.createContext({ interruptAfterMs: 100 });
      const fn = ctx.createFunction("inputSchema", "ctx", tool.functionBody);

      console.log("this is the input", { input });

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
  outputSchema: z.object({
    tools: z.array(z.object({ name: z.string(), description: z.string() })),
  }),
  handler: async (_, c) => {
    c.resourceAccess.grant();
    // await assertWorkspaceResourceAccess(c);

    return { tools: Array.from(store.values()) };
  },
});
