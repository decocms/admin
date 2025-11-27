/**
 * @decocms/bindings
 *
 * Core type definitions for the bindings system.
 * Bindings define standardized interfaces that integrations (MCPs) can implement.
 */

// Re-export core binder types and utilities
export {
  createBindingChecker,
  type Binder,
  type BindingChecker,
  type ToolBinder,
  type ToolWithSchemas,
} from "./core/binder";
