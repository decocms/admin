import { useThread } from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useParams } from "react-router";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgentProvider } from "../agent/provider.tsx";

const useThreadId = () => {
  const { id } = useParams();

  if (!id) {
    throw new Error("No id provided");
  }

  return id;
};

function Page() {
  const id = useThreadId();
  const { data: thread } = useThread(id);

  return (
    <AgentProvider agentId={thread?.metadata?.agentId ?? id} threadId={id}>
      <ScrollArea className="h-full py-6">
        <ChatMessages />
      </ScrollArea>
    </AgentProvider>
  );
}

export default Page;
