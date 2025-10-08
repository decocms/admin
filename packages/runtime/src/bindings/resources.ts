import {
  ResourceCreateInputSchema,
  ResourceCreateOutputSchema,
  ResourceDeleteInputSchema,
  ResourceDeleteOutputSchema,
  ResourceSearchInputSchema,
  ResourceSearchOutputSchema,
  ResourcesListInputSchema,
  ResourcesListOutputSchema,
  ResourcesReadInputSchema,
  ResourcesReadOutputSchema,
  ResourceUpdateInputSchema,
  ResourceUpdateOutputSchema,
} from "../resources.ts";
import type { ToolBinder } from "../mcp.ts";

// Export Schemas
export const RESOURCE_BINDING_SCHEMA = [
  {
    name: "DECO_CHAT_RESOURCES_READ" as const,
    inputSchema: ResourcesReadInputSchema,
    outputSchema: ResourcesReadOutputSchema,
  },
  {
    name: "DECO_CHAT_RESOURCES_SEARCH" as const,
    inputSchema: ResourceSearchInputSchema,
    outputSchema: ResourceSearchOutputSchema,
  },
  {
    name: "DECO_CHAT_RESOURCES_CREATE" as const,
    inputSchema: ResourceCreateInputSchema,
    outputSchema: ResourceCreateOutputSchema,
    opt: true,
  },
  {
    name: "DECO_CHAT_RESOURCES_UPDATE" as const,
    inputSchema: ResourceUpdateInputSchema,
    outputSchema: ResourceUpdateOutputSchema,
    opt: true,
  },
  {
    name: "DECO_CHAT_RESOURCES_DELETE" as const,
    inputSchema: ResourceDeleteInputSchema,
    outputSchema: ResourceDeleteOutputSchema,
    opt: true,
  },
  {
    name: "DECO_CHAT_RESOURCES_LIST" as const,
    inputSchema: ResourcesListInputSchema,
    outputSchema: ResourcesListOutputSchema,
  },
] as const satisfies readonly ToolBinder[];
