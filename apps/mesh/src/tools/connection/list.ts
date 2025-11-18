/**
 * CONNECTION_LIST Tool
 *
 * List all connections in the organization
 */

import Ajv, { type ValidateFunction } from "ajv";
import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireOrganization } from "../../core/mesh-context";
import { MODELS_BINDING_SCHEMA } from "../../core/bindings";

const ajv = new Ajv({ strict: false, allErrors: false });
const BUILTIN_BINDINGS: Record<string, object> = {
  MODELS: MODELS_BINDING_SCHEMA,
};

function resolveBindingSchema(
  binding?: Record<string, unknown> | string,
): object | null {
  if (!binding) return null;

  if (typeof binding === "string") {
    const schema = BUILTIN_BINDINGS[binding.toUpperCase()];
    if (!schema) {
      throw new Error(`Unknown binding schema: ${binding}`);
    }
    return schema;
  }

  return binding;
}

export const CONNECTION_LIST = defineTool({
  name: "CONNECTION_LIST",
  description: "List all connections in the organization",

  inputSchema: z.object({
    binding: z.union([z.object({}).passthrough(), z.string()]).optional(),
  }),

  outputSchema: z.object({
    connections: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        organizationId: z.string(),
        status: z.enum(["active", "inactive", "error"]),
        connectionType: z.enum(["HTTP", "SSE", "Websocket"]),
        connectionUrl: z.string(),
      }),
    ),
  }),

  handler: async (input, ctx) => {
    await ctx.access.check();

    const organization = requireOrganization(ctx);
    const schema = resolveBindingSchema(input.binding as
      | Record<string, unknown>
      | string
      | undefined);
    let validator: ValidateFunction<Record<string, unknown>> | undefined;

    if (schema) {
      try {
        validator = ajv.compile<Record<string, unknown>>(schema);
      } catch (error) {
        throw new Error(
          `Invalid binding schema provided: ${(error as Error).message}`,
        );
      }
    }

    const connections = await ctx.storage.connections.list(organization.id);

    const filteredConnections = validator
      ? connections.filter((connection) => {
          if (!connection.tools || connection.tools.length === 0) {
            return false;
          }

          const toolMap = Object.fromEntries(
            connection.tools.map((tool) => [
              tool.name,
              {
                input: tool.inputSchema ?? {},
                output: tool.outputSchema ?? {},
              },
            ]),
          );

          return validator?.(toolMap) ?? true;
        })
      : connections;

    return {
      connections: filteredConnections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        organizationId: c.organizationId,
        status: c.status,
        connectionType: c.connectionType,
        connectionUrl: c.connectionUrl,
      })),
    };
  },
});
