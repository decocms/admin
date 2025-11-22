/**
 * Core Binder Types and Utilities
 *
 * This module provides the core types and utilities for the bindings system.
 * Bindings define standardized interfaces that integrations (MCPs) can implement.
 */

import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { diffSchemas } from "json-schema-diff";

/**
 * ToolBinder defines a single tool within a binding.
 * It specifies the tool name, input/output schemas, and whether it's optional.
 *
 * @template TName - The tool name (can be a string or RegExp for pattern matching)
 * @template TInput - The input type (inferred from inputSchema)
 * @template TReturn - The return type (inferred from outputSchema)
 */
export interface ToolBinder<
  TName extends string | RegExp = string,
  // biome-ignore lint/suspicious/noExplicitAny: Generic type parameter
  TInput = any,
  TReturn extends object | null | boolean = object,
> {
  /** The name of the tool (e.g., "DECO_CHAT_CHANNELS_JOIN") */
  name: TName;

  /** Zod schema for validating tool input */
  inputSchema: ZodType<TInput>;

  /** Optional Zod schema for validating tool output */
  outputSchema?: ZodType<TReturn>;

  /**
   * Whether this tool is optional in the binding.
   * If true, an implementation doesn't need to provide this tool.
   */
  opt?: true;
}

/**
 * Binder represents a collection of tool definitions that form a binding.
 * A binding is like a TypeScript interface - it defines what tools must be implemented.
 *
 * @template TDefinition - Array of ToolBinder definitions
 *
 * @example
 * ```ts
 * const MY_BINDING = [{
 *   name: "MY_TOOL" as const,
 *   inputSchema: z.object({ id: z.string() }),
 *   outputSchema: z.object({ success: z.boolean() }),
 * }] as const satisfies Binder;
 * ```
 */
export type Binder<
  TDefinition extends readonly ToolBinder[] = readonly ToolBinder[],
> = TDefinition;

/**
 * Tool with schemas for validation
 */
export interface ToolWithSchemas {
  name: string;
  inputSchema?: ZodType<any> | Record<string, unknown>;
  outputSchema?: ZodType<any> | Record<string, unknown>;
}

/**
 * Converts a schema to JSON Schema format if it's a Zod schema
 */
function normalizeSchema(schema: any): Record<string, unknown> | undefined {
  if (!schema) return undefined;

  // If it's a Zod schema (has _def property), convert it
  if (schema._def) {
    const jsonSchema = zodToJsonSchema(schema, {
      // Don't add additionalProperties: false to allow structural compatibility
      $refStrategy: "none",
    }) as Record<string, unknown>;

    // Remove additionalProperties constraint to allow subtyping
    if (jsonSchema.type === "object") {
      delete jsonSchema.additionalProperties;
    }

    return jsonSchema;
  }

  // Otherwise assume it's already a JSON Schema
  const jsonSchema = schema as Record<string, unknown>;

  // Remove additionalProperties constraint if present
  if (jsonSchema.type === "object" && "additionalProperties" in jsonSchema) {
    const copy = { ...jsonSchema };
    delete copy.additionalProperties;
    return copy;
  }

  return jsonSchema;
}

/**
 * Binding checker interface
 */
export interface BindingChecker {
  /**
   * Check if a set of tools implements the binding with full schema validation.
   *
   * Validates:
   * - Tool name matches (exact or regex)
   * - Input schema: Tool accepts what binder requires (no removals from binder to tool)
   * - Output schema: Tool provides what binder expects (no removals from tool to binder)
   *
   * @param tools - Array of tools with names and schemas
   * @returns Promise<boolean> - true if all tools implement the binding correctly
   */
  isImplementedBy: (tools: ToolWithSchemas[]) => Promise<boolean>;
}

/**
 * Creates a binding checker with full schema validation using json-schema-diff.
 *
 * This performs strict compatibility checking:
 * - For input schemas: Validates that the tool can accept what the binder requires
 * - For output schemas: Validates that the tool provides what the binder expects
 *
 * @param binderTools - The binding definition to check against
 * @returns A binding checker with an async isImplementedBy method
 *
 * @example
 * ```ts
 * const checker = createBindingChecker(MY_BINDING);
 * const isCompatible = await checker.isImplementedBy(availableTools);
 * ```
 */
export function createBindingChecker<TDefinition extends readonly ToolBinder[]>(
  binderTools: TDefinition,
): BindingChecker {
  return {
    isImplementedBy: async (tools: ToolWithSchemas[]) => {
      for (const binderTool of binderTools) {
        // Find matching tool by name (exact or regex)
        const pattern = typeof binderTool.name === "string"
          ? new RegExp(`^${binderTool.name}$`)
          : binderTool.name;

        const matchedTool = tools.find((t) => pattern.test(t.name));

        // Skip optional tools that aren't present
        if (!matchedTool && binderTool.opt) {
          continue;
        }

        // Required tool not found
        if (!matchedTool) {
          return false;
        }

        // === INPUT SCHEMA VALIDATION ===
        // Tool must accept what binder requires
        // Check: binder (source) -> tool (destination)
        // If removals found, tool doesn't accept something binder requires
        const binderInputSchema = normalizeSchema(binderTool.inputSchema);
        const toolInputSchema = normalizeSchema(matchedTool.inputSchema);

        if (binderInputSchema && toolInputSchema) {
          try {
            const inputDiff = await diffSchemas({
              sourceSchema: binderInputSchema,
              destinationSchema: toolInputSchema,
            });

            // If something was removed from binder to tool, tool can't accept it
            if (inputDiff.removalsFound) {
              return false;
            }
          } catch (error) {
            console.error("Schema diff failed", error);
            // Schema diff failed - consider incompatible
            return false;
          }
        } else if (binderInputSchema && !toolInputSchema) {
          // Binder requires input schema but tool doesn't have one
          return false;
        }

        // === OUTPUT SCHEMA VALIDATION ===
        // Tool must provide what binder expects (but can provide more)
        // Check: binder (source) -> tool (destination)
        // If removals found, tool doesn't provide something binder expects
        const binderOutputSchema = normalizeSchema(binderTool.outputSchema);
        const toolOutputSchema = normalizeSchema(matchedTool.outputSchema);

        if (binderOutputSchema && toolOutputSchema) {
          try {
            const outputDiff = await diffSchemas({
              sourceSchema: binderOutputSchema,
              destinationSchema: toolOutputSchema,
            });

            // If something was removed from binder to tool, tool doesn't provide it
            if (outputDiff.removalsFound) {
              return false;
            }
          } catch (error) {
            console.error("Schema diff failed", error);
            // Schema diff failed - consider incompatible
            return false;
          }
        } else if (binderOutputSchema && !toolOutputSchema) {
          // Binder expects output schema but tool doesn't have one
          return false;
        }
      }

      return true;
    },
  };
}
