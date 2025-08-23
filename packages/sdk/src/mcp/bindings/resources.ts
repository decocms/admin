import {
  ResourcesReadInputSchema,
  ResourcesReadOutputSchema,
  ResourceSearchInputSchema,
  ResourceSearchOutputSchema,
} from "@deco/workers-runtime/resources";
import type { Binder } from "../index.ts";

// Export Schemas
export const RESOURCE_BINDING_SCHEMA = [
  {
    name: /^DECO_CHAT_RESOURCES_READ_(?<resource>[A-Z]+)$/,
    inputSchema: ResourcesReadInputSchema,
    outputSchema: ResourcesReadOutputSchema,
  },
  {
    name: /^DECO_CHAT_RESOURCES_SEARCH_(?<resource>[A-Z]+)$/,
    inputSchema: ResourceSearchInputSchema,
    outputSchema: ResourceSearchOutputSchema,
  },
] as const satisfies Binder;
