import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { ChatHeader } from "./ChatHeader.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
}

function ThreadView({ agentId, threadId }: Props) {
  if (!agentId || !threadId) {
    throw new Error("Missing agentId or threadId");
  }

  return (
    <ChatProvider agentId={agentId} threadId={threadId}>
      <ScrollArea className="h-full w-full px-4 py-2 bg-gradient-to-b from-white to-slate-50 p-6 text-slate-700">
        <ChatHeader />
        <ChatMessages />
      </ScrollArea>
    </ChatProvider>
  );
}

export default ThreadView;
