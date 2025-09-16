import {
  createSandboxRuntime,
  inspect,
  installConsole,
  QuickJSHandle,
} from "@deco/cf-sandbox";
import { Validator } from "jsonschema";
import { z } from "zod";
import { createToolGroup, MCPClientStub } from "../context.ts";
import { slugify } from "../deconfig/api.ts";
import { ProjectTools } from "../index.ts";
import { ToolDefinitionSchema } from "./api.ts";

// Utility functions for consistent naming
export const toolNameSlugify = (txt: string) => slugify(txt).toUpperCase();
export const fileNameSlugify = (txt: string) => slugify(txt).toLowerCase();

// Cache for compiled validators
const validatorCache = new Map<string, Validator>();

export function validate(instance: unknown, schema: Record<string, unknown>) {
  const schemaKey = JSON.stringify(schema);
  let validator = validatorCache.get(schemaKey);

  if (!validator) {
    validator = new Validator();
    validator.addSchema(schema);

    validatorCache.set(schemaKey, validator);
  }

  return validator.validate(instance, schema);
}

// Common tool group for sandbox
export const createTool = createToolGroup("Sandbox", {
  name: "Code Sandbox",
  description: "Run JavaScript code",
  icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
});

// Common function for evaluating code and returning default handle
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
    [Symbol.dispose]: ctx.dispose.bind(ctx),
  };
};

// Transform current workspace as callable integration environment
export const asEnv = async (client: MCPClientStub<ProjectTools>) => {
  const { items } = await client.INTEGRATIONS_LIST({});

  const env: Record<
    string,
    Record<string, (args: unknown) => Promise<unknown>>
  > = {};

  for (const item of items) {
    if (!("tools" in item)) {
      continue;
    }
    const tools = item.tools;

    if (!Array.isArray(tools)) {
      continue;
    }

    env[item.id] = Object.fromEntries(
      tools.map((tool: z.infer<typeof ToolDefinitionSchema>) => [
        tool.name,
        async (args: unknown) => {
          const inputValidation = validate(args, tool.inputSchema);

          if (!inputValidation.valid) {
            throw new Error(
              `Input validation failed: ${inspect(inputValidation)}`,
            );
          }

          const response = await client.INTEGRATIONS_CALL_TOOL({
            connection: item.connection,
            params: {
              name: tool.name,
              arguments: args as Record<string, unknown>,
            },
          });

          if (response.isError) {
            throw new Error(
              `Tool ${tool.name} returned an error: ${inspect(response)}`,
            );
          }

          if (response.structuredContent && tool.outputSchema) {
            const outputValidation = validate(
              response.structuredContent,
              tool.outputSchema,
            );

            if (!outputValidation.valid) {
              throw new Error(
                `Output validation failed: ${inspect(outputValidation)}`,
              );
            }

            return response.structuredContent;
          }

          return response.structuredContent || response.content;
        },
      ]),
    );
  }

  return env;
};

// Helper function to process execute code (inline or file URL)
export async function processExecuteCode(
  execute: string,
  filePath: string,
  client: MCPClientStub<ProjectTools>,
  branch?: string,
): Promise<{ functionCode: string; functionPath: string }> {
  const isFileUrl = execute.startsWith("file://");

  if (isFileUrl) {
    // It's already a file:// URL, use it as is
    const functionPath = execute.replace("file://", "");

    // Read the existing file to validate it
    const fileResult = await client.READ_FILE({
      branch,
      path: functionPath,
    });

    return {
      functionCode: fileResult.content,
      functionPath,
    };
  } else {
    // It's inline code, save it to a file
    const functionPath = filePath;
    const functionCode = execute;

    await client.PUT_FILE({
      branch,
      path: functionPath,
      content: functionCode,
    });

    return {
      functionCode,
      functionPath,
    };
  }
}

// Helper function to validate execute code
export async function validateExecuteCode(
  functionCode: string,
  runtimeId: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    using evaluation = await evalCodeAndReturnDefaultHandle(
      functionCode,
      runtimeId,
    );
    const { ctx, defaultHandle } = evaluation;

    if (ctx.typeof(defaultHandle) !== "function") {
      return {
        success: false,
        error: `${name} must export a default function`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Validation error for ${name}: ${inspect(error)}`,
    };
  }
}
