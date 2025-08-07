import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useAgent } from "./provider.tsx";
import ThreadList from "../threads/index.tsx";

function Threads() {
  const { agentId } = useAgent();

  return (
    <ScrollArea className="h-full w-full">
      <ThreadList agentId={agentId} />
    </ScrollArea>
  );
}

export default Threads;
