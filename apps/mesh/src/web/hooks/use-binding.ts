import { useMemo } from "react";
import { type Binder, createBindingChecker } from "@decocms/bindings";
import { AGENTS_BINDING } from "@decocms/bindings/agent";
import { LANGUAGE_MODEL_BINDING } from "@decocms/bindings/llm";
import { type ConnectionEntity } from "@/web/hooks/collections/use-connection";

/**
 * Map of well-known binding names to their definitions
 */
const BUILTIN_BINDINGS: Record<string, Binder> = {
  LLMS: LANGUAGE_MODEL_BINDING,
  AGENTS: AGENTS_BINDING,
};

/**
 * Checks if a connection implements a binding by validating its tools
 */
function connectionImplementsBinding(
  connection: ConnectionEntity,
  binding: Binder,
): boolean {
  const tools = connection.tools;

  if (!tools || tools.length === 0) {
    return false;
  }

  // Prepare tools for checker (only input schema, skip output for detection)
  const toolsForChecker = tools.map((t) => ({
    name: t.name,
    inputSchema: t.inputSchema as Record<string, unknown> | undefined,
  }));

  // Create binding checker without output schemas
  const bindingForChecker = binding.map((b) => ({
    name: b.name,
    inputSchema: b.inputSchema,
    opt: b.opt,
  }));

  const checker = createBindingChecker(bindingForChecker);
  const result = checker.isImplementedBy(toolsForChecker);

  return result;
}

/**
 * Hook to filter connections that implement a specific binding.
 * Returns only connections whose tools satisfy the binding requirements.
 *
 * @param connections - Array of connections to filter
 * @param bindingName - Name of the binding to check ("LLMS" | "AGENTS")
 * @returns Filtered array of connections that implement the binding
 */
export function useBindingConnections(
  connections: ConnectionEntity[] | undefined,
  bindingName: string,
): ConnectionEntity[] {
  const binding = BUILTIN_BINDINGS[bindingName];

  return useMemo(
    () =>
      !connections || !binding
        ? []
        : connections.filter((conn) =>
          connectionImplementsBinding(conn, binding)
        ),
    [connections, binding],
  );
}
