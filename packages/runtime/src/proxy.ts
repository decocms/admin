// deno-lint-ignore-file no-explicit-any
import type { ToolExecutionContext } from "@mastra/core";
import { MCPConnection } from "./connection.ts";
import { createServerClient } from "./mcp-client.ts";
import type { CreateStubAPIOptions } from "./mcp.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const getWorkspace = (workspace?: string) => {
  if (workspace && workspace.length > 0 && !workspace.includes("/")) {
    return `/shared/${workspace}`;
  }
  return workspace ?? "";
};

let tools:
  | Promise<
    {
      name: string;
      inputSchema: any;
      outputSchema?: any;
      description: string;
    }[] | undefined
  >
  | undefined;

/**
 * The base fetcher used to fetch the MCP from API.
 */
export function createMCPClientProxy<T extends Record<string, unknown>>(
  options?: CreateStubAPIOptions,
): T {
  const decoChatApiConnection: MCPConnection = {
    type: "HTTP",
    url: `${options?.decoChatApiUrl ?? `https://api.deco.chat`}${
      getWorkspace(options?.workspace)
    }/mcp`,
    token: options?.token,
  };

  let clientPromise: Promise<Client> | undefined;

  return new Proxy<T>({} as T, {
    get(_, name) {
      if (name === "toJSON") {
        return null;
      }
      if (typeof name !== "string") {
        throw new Error("Name must be a string");
      }
      async function callToolFn(args: unknown) {
        const connectionPromise = typeof options?.connection === "function"
          ? options.connection()
          : Promise.resolve(options?.connection);
        clientPromise ??= connectionPromise.then((connection) => {
          return createServerClient({
            connection: connection ?? decoChatApiConnection,
          });
        });
        const client = await clientPromise;
        const { structuredContent, isError } = await client.callTool({
          name: String(name),
          arguments: args as Record<string, unknown>,
        });
        if (isError) {
          throw new Error(
            `Tool ${String(name)} returned an error: ${structuredContent}`,
          );
        }
        return structuredContent;
      }

      const listToolsFn = async () => {
        const connectionPromise = typeof options?.connection === "function"
          ? options.connection()
          : Promise.resolve(options?.connection);
        clientPromise ??= connectionPromise.then((connection) => {
          return createServerClient({
            connection: connection ?? decoChatApiConnection,
          });
        });
        const client = await clientPromise;
        const { tools } = await client.listTools();

        return tools as {
          name: string;
          inputSchema: any;
          outputSchema?: any;
          description: string;
        }[];
      };

      const listToolsOnce = () => {
        return (tools ??= listToolsFn().catch((error) => {
          console.error("Failed to list tools", error);
          return undefined;
        }));
      };
      callToolFn.asTool = async () => {
        const tools = (await listToolsOnce()) ?? [];
        const tool = tools.find((t) => t.name === name);
        if (!tool) {
          throw new Error(`Tool ${name} not found`);
        }
        return {
          ...tool,
          id: tool.name,
          execute: ({ context }: ToolExecutionContext<any>) => {
            return callToolFn(context);
          },
        };
      };
      return callToolFn;
    },
  });
}
