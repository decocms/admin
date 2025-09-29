import { useThread } from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useParams } from "react-router";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgentProvider } from "../agent/provider.tsx";
import { type DecopilotContextValue } from "../decopilot/context.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";

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

  const decopilotContextValue: DecopilotContextValue = {
    additionalTools: {},
  };

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <AgentProvider agentId={thread?.metadata?.agentId ?? id} threadId={id}>
        <ScrollArea className="h-full py-6">
          <ChatMessages />
        </ScrollArea>
      </AgentProvider>
    </DecopilotLayout>
  );
}

export default Page;
