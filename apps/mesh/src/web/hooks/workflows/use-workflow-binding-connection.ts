import { useConnections } from "../collections/use-connection";
import { useBindingConnections } from "../use-binding";

export function useWorkflowBindingConnection() {
  const connections = useConnections();
  const connection = useBindingConnections({ connections, binding: "WORKFLOWS" });
  if (!connection || connection.length === 0 || !connection[0]) {
    throw new Error("No workflow connection found");
  }
  return connection[0];
}
