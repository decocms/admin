import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useChatContext } from "../chat/context.tsx";
import ThreadList from "../threads/index.tsx";

function Threads() {
  const { agentId } = useChatContext();

  return (
    <ScrollArea className="h-full w-full">
      <ThreadList agentId={agentId} />
    </ScrollArea>
  );
}

export default Threads;
