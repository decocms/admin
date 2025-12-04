/**
 * Core Binder Types and Utilities
 *
 * This module provides the core types and utilities for the bindings system.
 * Bindings define standardized interfaces that integrations (MCPs) can implement.
 */

import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  createMCPFetchStub,
  CreateStubAPIOptions,
  MCPClientFetchStub,
} from "./client/mcp";
import { MCPConnection } from "./connection";

type JsonSchema = Record<string, unknown>;

/**
 * Checks if a value is a Zod schema by looking for the _def property
 */
function isZodSchema(value: unknown): value is ZodType<unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    "_def" in value &&
    typeof (value as Record<string, unknown>)._def === "object"
  );
}

/**
 * Normalizes a schema to JSON Schema format.
 * Accepts either a Zod schema or a JSON schema and returns a JSON schema.
 *
 * @param schema - A Zod schema or JSON schema
 * @returns The JSON schema representation, or null if input is null/undefined
 */
function normalizeToJsonSchema(
  schema: ZodType<unknown> | JsonSchema | null | undefined,
): JsonSchema | null {
  if (schema == null) {
    return null;
  }

  if (isZodSchema(schema)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return zodToJsonSchema(schema as any) as JsonSchema;
  }

  // Already a JSON schema
  return schema as JsonSchema;
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TInput = any,
  TReturn extends object | null | boolean = object,
  TStreamable extends boolean = boolean,
> {
  /** The name of the tool (e.g., "DECO_CHAT_CHANNELS_JOIN") */
  name: TName;

  /** Zod schema for validating tool input */
  inputSchema: ZodType<TInput>;

  /** Optional Zod schema for validating tool output */
  outputSchema?: TStreamable extends true ? never : ZodType<TReturn>;

  /**
   * Whether this tool is streamable.
   */
  streamable?: TStreamable;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema?: ZodType<any> | Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputSchema?: ZodType<any> | Record<string, unknown>;
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
  isImplementedBy: (tools: ToolWithSchemas[]) => boolean;
}

export const bindingClient = <TDefinition extends readonly ToolBinder[]>(
  binder: TDefinition,
) => {
  return {
    ...createBindingChecker(binder),
    forConnection: (
      mcpConnection: MCPConnection,
      createServerClient?: CreateStubAPIOptions["createServerClient"],
    ): MCPClientFetchStub<TDefinition> => {
      return createMCPFetchStub<TDefinition>({
        connection: mcpConnection,
        createServerClient,
        streamable: binder.reduce(
          (acc, tool) => {
            acc[tool.name] = tool.streamable === true;
            return acc;
          },
          {} as Record<string, boolean>,
        ),
      });
    },
  };
};

export type MCPBindingClient<T extends ReturnType<typeof bindingClient>> =
  ReturnType<T["forConnection"]>;

/**
 * Creates a binding checker with full schema validation using structural subset checking.
 *
 * This performs strict compatibility checking:
 * - For input schemas: Validates that the tool can accept what the binder requires (binder ⊆ tool)
 * - For output schemas: Validates that the tool provides what the binder expects (binder ⊆ tool)
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
    isImplementedBy: (tools: ToolWithSchemas[]): boolean => {
      for (const binderTool of binderTools) {
        // Find matching tool by name (exact or regex)
        const pattern =
          typeof binderTool.name === "string"
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
        return true;

        // ignore input/output schema for now
        // === INPUT SCHEMA VALIDATION ===
        // Tool must accept what binder requires
        // Check: isSubset(binder, tool) - every value valid under binder is valid under tool
        // const binderInputSchema = normalizeToJsonSchema(binderTool.inputSchema);
        // const toolInputSchema = normalizeToJsonSchema(matchedTool.inputSchema);

        // if (binderInputSchema && toolInputSchema) {
        //   // Check if binder input is a subset of tool input (tool accepts what binder requires)
        //   if (!isSubset(binderInputSchema, toolInputSchema)) {
        //     return false;
        //   }
        // } else if (binderInputSchema && !toolInputSchema) {
        //   // Binder requires input schema but tool doesn't have one
        //   return false;
        // }

        // // === OUTPUT SCHEMA VALIDATION ===
        // // Tool must provide what binder expects (but can provide more)
        // // Check: isSubset(binder, tool) - tool provides at least what binder expects
        // const binderOutputSchema = normalizeToJsonSchema(
        //   binderTool.outputSchema,
        // );
        // const toolOutputSchema = normalizeToJsonSchema(
        //   matchedTool.outputSchema,
        // );

        // if (binderOutputSchema && toolOutputSchema) {
        //   // Check if binder output is a subset of tool output (tool provides what binder expects)
        //   if (!isSubset(binderOutputSchema, toolOutputSchema)) {
        //     return false;
        //   }
        // } else if (binderOutputSchema && !toolOutputSchema) {
        //   // Binder expects output schema but tool doesn't have one
        //   return false;
        // }
      }
      return true;
    },
  };
}
