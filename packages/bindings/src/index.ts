import { LanguageModelBinding } from "../../runtime/src/bindings/binder";
/**
 * @decocms/bindings
 *
 * Core type definitions for the bindings system.
 * Bindings define standardized interfaces that integrations (MCPs) can implement.
 */

// Re-export core binder types and utilities
export {
  type ToolBinder,
  type Binder,
  type ToolWithSchemas,
  type BindingChecker,
  createBindingChecker,
} from "./core/binder";
export * from "./well-known/language-model";
