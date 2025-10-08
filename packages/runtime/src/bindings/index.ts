import { CHANNEL_BINDING_SCHEMA } from "./channels.ts";
import { RESOURCE_BINDING_SCHEMA } from "./resources.ts";
import { VIEW_BINDING_SCHEMA } from "./views.ts";

// Import new Resources 2.0 bindings function
import { createResourceV2Bindings } from "./resources/bindings.ts";

// Export types and utilities from binder
export {
  type Binder,
  type BinderImplementation,
  type ToolLike,
  type CreateToolOptions,
  bindingClient,
  type MCPBindingClient,
  ChannelBinding,
  ViewBinding,
  impl,
} from "./binder.ts";

// Export all channel types and schemas
export * from "./channels.ts";

// Export binding utilities
export * from "./utils.ts";

// Export resources schemas (v1)
export * from "./resources.ts";

// Export views schemas
export * from "./views.ts";

// Re-export Resources 2.0 bindings function for convenience
export { createResourceV2Bindings };

// Export resources v2 types and schemas
export * from "./resources/schemas.ts";
export * from "./resources/bindings.ts";
export * from "./resources/helpers.ts";

export const WellKnownBindings = {
  Channel: CHANNEL_BINDING_SCHEMA,
  View: VIEW_BINDING_SCHEMA,
  Resources: RESOURCE_BINDING_SCHEMA,
  // Note: ResourcesV2 is not included here since it's a generic function
  // Use createResourceV2Bindings(dataSchema) directly for Resources 2.0
} as const;

export type WellKnownBindingsName = keyof typeof WellKnownBindings;
