import { useEffect, useMemo, useState } from "react";
import { type Binder, createBindingChecker } from "@decocms/bindings";
import { AGENTS_BINDING } from "@decocms/bindings/agents";
import { MODELS_BINDING } from "@decocms/bindings/models";
import {
  useConnections,
  type ConnectionEntity,
} from "@/web/hooks/use-connections";
import { useCurrentOrganization } from "@/web/hooks/use-current-organization";

/**
 * Map of well-known binding names to their definitions
 */
const BUILTIN_BINDINGS: Record<string, Binder> = {
  MODELS: MODELS_BINDING,
  AGENTS: AGENTS_BINDING,
};

/**
 * Checks if a connection implements a binding by validating its tools
 */
async function connectionImplementsBinding(
  connection: ConnectionEntity,
  binding: Binder,
): Promise<boolean> {
  const tools = connection.tools;
  if (!tools || tools.length === 0) return false;

  try {
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
    return await checker.isImplementedBy(toolsForChecker);
  } catch {
    return false;
  }
}

/**
 * Hook to get all connections that implement a specific binding.
 * Uses proper binding validation with createBindingChecker.
 */
export function useBindingConnections(bindingName: string) {
  const {
    organization,
    isLoading: orgLoading,
    error: orgError,
  } = useCurrentOrganization();

  // Get all connections using the collection hook
  const { data: allConnections, isPending: connectionsLoading } =
    useConnections();

  // Get the binding definition
  const binding = BUILTIN_BINDINGS[bindingName];

  // State for validated connections
  const [validatedConnections, setValidatedConnections] = useState<
    ConnectionEntity[]
  >([]);
  const [isValidating, setIsValidating] = useState(false);

  // Memoize connection IDs to detect changes
  const connectionIds = useMemo(
    () => allConnections?.map((c) => c.id).join(",") ?? "",
    [allConnections],
  );

  // Validate connections when they change
  useEffect(() => {
    if (!allConnections || !binding) {
      setValidatedConnections([]);
      return;
    }

    let cancelled = false;
    setIsValidating(true);

    async function validateConnections() {
      const results = await Promise.all(
        allConnections!.map(async (conn) => ({
          connection: conn,
          isValid: await connectionImplementsBinding(conn, binding!),
        })),
      );

      if (!cancelled) {
        setValidatedConnections(
          results.filter((r) => r.isValid).map((r) => r.connection),
        );
        setIsValidating(false);
      }
    }

    validateConnections();

    return () => {
      cancelled = true;
    };
  }, [connectionIds, binding]);

  const isLoading = orgLoading || connectionsLoading || isValidating;
  const isReady = validatedConnections.length > 0 && !isLoading;

  return {
    organization,
    connections: validatedConnections,
    isReady,
    isLoading,
    error: orgError,
  };
}

/**
 * @deprecated Use useBindingConnections("MODELS") instead
 */
export function useModelsBindingState() {
  return useBindingConnections("MODELS");
}
