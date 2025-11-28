import * as z from "zod/v3";
import { MCPConnectionSchema } from "../../models/mcp.ts";

export const RegistryScopeSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    scopeName: z.string(),
    workspace: z.string().nullable(),
    projectId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

const RegistryToolSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    inputSchema: z.record(z.unknown()),
    outputSchema: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
);

export const RegistryAppSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    workspace: z.string().nullable(),
    scopeId: z.string(),
    scopeName: z.string(),
    appName: z.string(),
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    connection: MCPConnectionSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    unlisted: z.boolean(),
    friendlyName: z.string().optional(),
    verified: z.boolean().optional(),
    tools: z.array(RegistryToolSchema).optional(),
    metadata: z.record(z.unknown()).optional().nullable(),
  }),
);

export type RegistryScope = z.infer<typeof RegistryScopeSchema>;
export type RegistryApp = z.infer<typeof RegistryAppSchema>;
