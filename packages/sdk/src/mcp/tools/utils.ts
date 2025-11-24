import {
  createSandboxRuntime,
  inspect,
  installConsole,
  QuickJSHandle,
} from "@deco/cf-sandbox";
import { proxyConnectionForId } from "@decocms/runtime";
import { Validator } from "jsonschema";
import { MCPConnection } from "../../models/mcp.ts";
import { MCPClientStub } from "../context.ts";
import { ProjectTools } from "../index.ts";

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
export const asEnv = (
  client: MCPClientStub<ProjectTools>,
  {
    authorization,
    workspace,
    dependencies = [],
  }: {
    authorization?: string;
    workspace?: string;
    dependencies?: Array<{
      integrationId: string;
      toolNames?: string[];
    }>;
  } = {},
) => {
  const cache = new Map<string, MCPConnection>();

  // Helper function to create a tool caller
  const createToolCaller = (integrationId: string, toolName: string) => {
    return async (args: unknown) => {
      let connection;
      if (authorization && workspace) {
        connection = proxyConnectionForId(integrationId, {
          workspace: workspace,
          token: authorization,
        });
      } else {
        connection = cache.get(integrationId);
        if (!connection) {
          const mConnection = await client.INTEGRATIONS_GET({
            id: integrationId,
          });
          cache.set(integrationId, mConnection.connection);
        }
        connection = cache.get(integrationId);
      }

      const response = await client.INTEGRATIONS_CALL_TOOL({
        connection,
        params: {
          name: toolName,
          arguments: args as Record<string, unknown>,
        },
      });

      if (response.isError) {
        throw new Error(
          `Tool ${toolName} returned an error: ${inspect(response)}`,
        );
      }

      return response.structuredContent || response.content;
    };
  };

  // Build the env object based on dependencies
  const env: Record<
    string,
    Record<string, (args: unknown) => Promise<unknown>>
  > = {};

  for (const dependency of dependencies) {
    const { integrationId, toolNames } = dependency;

    // Create an integration namespace if it doesn't exist
    if (!env[integrationId]) {
      env[integrationId] = {};
    }

    // If toolNames is undefined, create a Proxy that allows any tool name (backward compatibility)
    // Otherwise, add only the specified tools
    if (toolNames === undefined) {
      // Create a Proxy that dynamically creates tool callers for any accessed property
      env[integrationId] = new Proxy(
        {},
        {
          get(_target, toolName: string) {
            return createToolCaller(integrationId, toolName);
          },
        },
      );
    } else {
      // Add each specified tool to the integration namespace
      for (const toolName of toolNames) {
        env[integrationId][toolName] = createToolCaller(
          integrationId,
          toolName,
        );
      }
    }
  }

  return env;
};

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
