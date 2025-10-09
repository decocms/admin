import { CHANNEL_BINDING_SCHEMA } from "./channels.ts";
import { VIEW_BINDING_SCHEMA } from "./views.ts";

// Import new Resources 2.0 bindings function
import { createResourceBindings } from "./resources/bindings.ts";

// Export types and utilities from binder
export {
  bindingClient,
  ChannelBinding,
  impl,
  ViewBinding,
  type Binder,
  type BinderImplementation,
  type MCPBindingClient,
  type ToolLike,
} from "./binder.ts";

// Export all channel types and schemas
export * from "./channels.ts";

// Export binding utilities
export * from "./utils.ts";

// Export views schemas
export * from "./views.ts";

// Re-export Resources bindings function for convenience
export { createResourceBindings };

// Export resources types and schemas
export * from "./resources/bindings.ts";
export * from "./resources/helpers.ts";
export * from "./resources/schemas.ts";

// Export deconfig helpers and types
export {
  buildFilePath as deconfigBuildFilePath,
  constructResourceUri as deconfigConstructResourceUri,
  extractResourceId as deconfigExtractResourceId,
  getMetadataString as deconfigGetMetadataString,
  getMetadataValue as deconfigGetMetadataValue,
  normalizeDirectory as deconfigNormalizeDirectory,
} from "./deconfig/helpers.ts";
export { createDeconfigResource } from "./deconfig/index.ts";
export type {
  DeconfigClient,
  DeconfigResourceOptions,
  EnhancedResourcesTools,
  ResourcesBinding,
  ResourcesTools,
} from "./deconfig/index.ts";
export { deconfigTools } from "./deconfig/types.ts";

export const WellKnownBindings = {
  Channel: CHANNEL_BINDING_SCHEMA,
  View: VIEW_BINDING_SCHEMA,
  // Note: Resources is not included here since it's a generic function
  // Use createResourceBindings(dataSchema) directly for Resources 2.0
} as const;

export type WellKnownBindingsName = keyof typeof WellKnownBindings;
