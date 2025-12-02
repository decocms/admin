/**
 * Hook to get active connections
 *
 * Filters connections with status "active" only
 */

import { useMemo } from "react";
import { useConnections } from "./use-connection";

export function useActiveConnections() {
  const { data: connections = [], ...rest } = useConnections();

  const activeConnections = useMemo(() => {
    return connections.filter((conn) => conn.status === "active");
  }, [connections]);

  return {
    data: activeConnections,
    ...rest,
  };
}


