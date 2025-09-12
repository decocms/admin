import {
  callFunction,
  createSandboxRuntime,
  inspect,
  installBuffer,
  installConsole,
  QuickJSHandle,
} from "@deco/cf-sandbox";
import { Validator } from "jsonschema";
import z from "zod";
import { createToolGroup } from "../context.ts";
import { slugify } from "../deconfig/api.ts";
import { assertWorkspaceResourceAccess, MCPClient } from "../index.ts";

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
  execute: "export default async function (input, ctx) { return { greeting: 'Hello, ' + input.name }; }"
}

The execute field can be either:
1. Inline ES module code (will be saved to /src/functions/{name}.ts)
2. A file:// URL to an existing function file

The execute should be a complete ES module with a default export function that has this exact signature:
async (input: typeof inputSchema, ctx: unknown): Promise<typeof outputSchema> => {}

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
    .describe(
      "Either a file:// URL to an existing function file, or inline ES module code with default export function. If inline code is provided, it will be saved to /src/functions/{name}.ts",
    ),
});

export const evalCodeAndReturnDefaultHandle = async (
  code: string,
  runtimeId: string,
) => {
  // Create sandbox runtime to validate the function
  const runtime = await createSandboxRuntime(runtimeId, {
    memoryLimitBytes: 64 * 1024 * 1024, // 64MB
    stackSizeBytes: 1 << 20, // 1MB,
  });

  const ctx = runtime.newContext({ interruptAfterMs: 100 });

  // Install built-ins
  const guestConsole = installConsole(ctx);
  const guestBuffer = installBuffer(ctx);

  // Validate the function by evaluating it as an ES module
  const result = ctx.evalCode(code, "index.js", {
    strict: true,
    strip: true,
    type: "module",
  });

  let exportsHandle: QuickJSHandle;
  if (ctx.runtime.hasPendingJob()) {
    const promise = ctx.resolvePromise(ctx.unwrapResult(result));
    ctx.runtime.executePendingJobs();
    exportsHandle = ctx.unwrapResult(await promise);
  } else {
    exportsHandle = ctx.unwrapResult(result);
  }

  const defaultHandle = ctx.getProp(exportsHandle, "default");

  return {
    ctx,
    defaultHandle,
    guestConsole,
    guestBuffer,
    [Symbol.dispose]: ctx.dispose.bind(ctx),
  };
};

const sandboxCreateTool = createTool({
  name: "SANDBOX_UPSERT_TOOL",
  description: SANDBOX_CREATE_TOOL_DESCRIPTION,
  inputSchema: ToolDefinitionSchema,
  outputSchema: z.object({
    success: z.boolean().describe("Whether the tool was created successfully"),
    error: z.string().optional().describe(
      "Compilation or validation error if any",
    ),
  }),
  handler: async (
    { name, description, inputSchema, outputSchema, execute },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c);

    const runtimeId = c.locator?.value ?? "default";
    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);
    const slugName = slugify(name);
    const filename = slugName.toLowerCase();
    const toolName = slugName.toUpperCase();

    try {
      // Determine if execute is a file:// URL or inline code
      const isFileUrl = execute.startsWith("file://");
      let functionCode: string;
      let functionPath: string;

      if (isFileUrl) {
        // It's already a file:// URL, use it as is
        functionPath = execute.replace("file://", "");

        // Read the existing file to validate it
        const fileResult = await client.READ_FILE({
          branch,
          path: functionPath,
        });
        functionCode = fileResult.content;
      } else {
        // It's inline code, save it to a file
        functionPath = `/src/functions/${filename}.ts`;
        functionCode = execute;

        await client.PUT_FILE({
          branch,
          path: functionPath,
          content: functionCode,
        });
      }

      using evaluation = await evalCodeAndReturnDefaultHandle(
        functionCode,
        runtimeId,
      );
      const { ctx, defaultHandle } = evaluation;

      if (ctx.typeof(defaultHandle) !== "function") {
        return {
          success: false,
          error: "Module must export a default function",
        };
      }

      // Store the tool metadata with file reference
      const toolPath = `/src/tools/${filename}.json`;

      const toolData = {
        name: toolName,
        description,
        inputSchema,
        outputSchema,
        execute: `file://${functionPath}`,
      };

      await client.PUT_FILE({
        branch,
        path: toolPath,
        content: JSON.stringify(toolData, null, 2),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: inspect(error),
      };
    }
  },
});

const sandboxRunTool = createTool({
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
    await assertWorkspaceResourceAccess(c);

    const runtimeId = c.locator?.value ?? "default";
    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);

    let tool: z.infer<typeof ToolDefinitionSchema>;
    try {
      const toolFileName = slugify(name);
      const toolPath = `/src/tools/${toolFileName}.json`;

      const result = await client.READ_FILE({
        branch,
        path: toolPath,
        format: "json",
      });

      tool = result.content as z.infer<typeof ToolDefinitionSchema>;
    } catch (error) {
      return { error: "Tool not found" };
    }

    // Validate input against the tool's input schema
    const inputValidation = validate(input, tool.inputSchema);
    if (!inputValidation.valid) {
      return { error: `Input validation failed: ${inspect(inputValidation)}` };
    }

    // Load the function code from the file
    const functionPath = tool.execute.replace("file://", "");
    if (!functionPath) {
      return { error: "Tool function file not found" };
    }

    const functionResult = await client.READ_FILE({
      branch,
      path: functionPath,
      format: "plainString",
    });

    const functionCode = functionResult.content;

    using evaluation = await evalCodeAndReturnDefaultHandle(
      functionCode,
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
        {
          env: {
            get: async () => {
              const response = await fetch("https://example.com");
              const data = await response.text();
              return data;
            },
          },
        },
      );

      const callResult = ctx.dump(ctx.unwrapResult(callHandle));

      // Validate output against the tool's output schema
      const outputValidation = validate(callResult, tool.outputSchema);

      if (!outputValidation.valid) {
        return {
          error: `Output validation failed: ${inspect(outputValidation)}`,
          logs: guestConsole.logs,
        };
      }

      return { result: callResult, logs: guestConsole.logs };
    } catch (error) {
      return { error: inspect(error), logs: guestConsole.logs };
    }
  },
});

const getTool = createTool({
  name: "SANDBOX_GET_TOOL",
  description: "Get a tool from the sandbox",
  inputSchema: z.object({ name: z.string().describe("The name of the tool") }),
  outputSchema: z.object({
    tool: ToolDefinitionSchema.optional().describe(
      "The tool definition if found",
    ),
    found: z.boolean().describe("Whether the tool was found"),
  }),
  handler: async ({ name }, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;

    try {
      const toolFileName = slugify(name);
      const toolPath = `/src/tools/${toolFileName}.json`;

      const client = MCPClient.forContext(c);
      const result = await client.READ_FILE({
        branch,
        path: toolPath,
        format: "json",
      }) as {
        content: any;
        address: string;
        metadata: any;
        mtime: number;
        ctime: number;
      };

      return {
        tool: result.content as z.infer<typeof ToolDefinitionSchema>,
        found: true,
      };
    } catch (error) {
      return {
        tool: undefined,
        found: false,
      };
    }
  },
});

const deleteTool = createTool({
  name: "SANDBOX_DELETE_TOOL",
  description: "Delete a tool in the sandbox",
  inputSchema: z.object({ name: z.string().describe("The name of the tool") }),
  outputSchema: z.object({
    message: z.string().describe("The message of the tool"),
  }),
  handler: async ({ name }, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;

    try {
      const toolFileName = slugify(name);
      const toolPath = `/src/tools/${toolFileName}.json`;

      const client = MCPClient.forContext(c);

      // First, get the tool to find the function file
      try {
        const toolResult = await client.READ_FILE({
          branch,
          path: toolPath,
          format: "json",
        }) as {
          content: any;
          address: string;
          metadata: any;
          mtime: number;
          ctime: number;
        };

        const tool = toolResult.content;
        if (tool.execute && tool.execute.startsWith("file://")) {
          const functionPath = tool.execute.replace("file://", "");
          await client.DELETE_FILE({
            branch,
            path: functionPath,
          });
        }
      } catch (error) {
        // Tool file might not exist, continue with deletion
      }

      // Delete the tool metadata file
      await client.DELETE_FILE({
        branch,
        path: toolPath,
      });

      return { message: "Tool deleted successfully" };
    } catch (error) {
      return { message: "Tool deletion failed" };
    }
  },
});

const sandboxListTools = createTool({
  name: "SANDBOX_LIST_TOOLS",
  description: "List all tools in the sandbox",
  inputSchema: z.object({}),
  outputSchema: z.object({ tools: z.array(ToolDefinitionSchema) }),
  handler: async (_, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;

    try {
      const client = MCPClient.forContext(c);
      const result = await client.LIST_FILES({
        branch,
        prefix: "/src/tools/",
      });

      const tools: z.infer<typeof ToolDefinitionSchema>[] = [];

      for (const [filePath, fileInfo] of Object.entries(result.files)) {
        if (filePath.endsWith(".json")) {
          try {
            const toolResult = await client.READ_FILE({
              branch,
              path: filePath,
              format: "json",
            }) as {
              content: any;
              address: string;
              metadata: any;
              mtime: number;
              ctime: number;
            };
            tools.push(
              toolResult.content as z.infer<typeof ToolDefinitionSchema>,
            );
          } catch (error) {
            // Skip files that can't be read as valid tool JSON
            console.warn(`Failed to read tool file ${filePath}:`, error);
          }
        }
      }

      return { tools };
    } catch (error) {
      return { tools: [] };
    }
  },
});

export const SANDBOX_TOOLS = [
  sandboxCreateTool,
  getTool,
  deleteTool,
  sandboxRunTool,
  sandboxListTools,
];
