// Types for DeconfigResource
import { z } from "zod";
import type { DefaultEnv } from "../../index.ts";
import type { MCPClientFetchStub, ToolBinder } from "../../mcp.ts";
import type { BaseResourceDataSchema } from "../resources/bindings.ts";

export type ResourcesBinding<TDataSchema extends BaseResourceDataSchema> =
  ReturnType<
    typeof import("../resources/bindings.ts").createResourceBindings<TDataSchema>
  >;

export type ResourcesTools<TDataSchema extends BaseResourceDataSchema> =
  ResourcesBinding<TDataSchema>[number]["name"];

export type EnhancedResourcesTools<TDataSchema extends BaseResourceDataSchema> =
  Partial<
    Record<
      ResourcesTools<TDataSchema>,
      {
        description: string;
      }
    >
  >;

// Define deconfig tools as ToolBinder array (same pattern as workspaceTools in mcp.ts)
export const deconfigTools = [
  {
    name: "LIST_FILES" as const,
    inputSchema: z.object({
      branch: z.string().optional(),
      prefix: z.string().optional(),
      select: z.array(z.string()).optional(),
      includeContent: z.boolean().optional(),
    }),
    outputSchema: z.object({
      files: z.record(
        z.string(),
        z.object({
          address: z.string(),
          metadata: z.record(z.string(), z.any()),
          sizeInBytes: z.number(),
          mtime: z.number(),
          ctime: z.number(),
          content: z.string().optional(),
        }),
      ),
      count: z.number(),
    }),
  },
  {
    name: "READ_FILE" as const,
    inputSchema: z.object({
      branch: z.string().optional(),
      path: z.string(),
      format: z.enum(["base64", "byteArray", "plainString", "json"]).optional(),
    }),
    outputSchema: z.object({
      content: z.any(),
      address: z.string(),
      metadata: z.record(z.any()),
      mtime: z.number(),
      ctime: z.number(),
    }),
  },
  {
    name: "PUT_FILE" as const,
    inputSchema: z.object({
      branch: z.string().optional(),
      path: z.string(),
      content: z.union([
        z.string(),
        z.object({ base64: z.string() }),
        z.array(z.number()),
      ]),
      metadata: z.record(z.any()).optional(),
      expectedCtime: z.number().optional(),
    }),
    outputSchema: z.object({
      conflict: z.boolean().optional(),
    }),
  },
  {
    name: "DELETE_FILE" as const,
    inputSchema: z.object({
      branch: z.string().optional(),
      path: z.string(),
    }),
    outputSchema: z.object({
      deleted: z.boolean(),
    }),
  },
] as const satisfies readonly ToolBinder[];

// DeconfigClient is now a typed MCP client stub (same pattern as workspaceTools)
export type DeconfigClient = MCPClientFetchStub<typeof deconfigTools>;

export interface DeconfigResourceOptions<
  TDataSchema extends BaseResourceDataSchema,
> {
  directory?: string; // defaults to /resources/$resourceName
  resourceName: string;
  env: DefaultEnv & { DECONFIG: DeconfigClient };
  dataSchema: TDataSchema;
  enhancements?: EnhancedResourcesTools<TDataSchema>;
  validate?: (data: z.infer<TDataSchema>) => Promise<void>;
}
