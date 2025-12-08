import { useConnections } from "../collections/use-connection";
import { useBindingConnections } from "../use-binding";

export function useWorkflowBindingConnection() {
  const connections = useConnections();
  const connection = useBindingConnections(connections, "WORKFLOWS")[0];
  if (!connection) {
    throw new Error("No workflow connection found");
  }
  return connection;
}
