import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { ChatHeader } from "./ChatHeader.tsx";

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
      <div className="flex items-center justify-between p-4">
        <ChatHeader />
      </div>
      <ScrollArea className="h-full w-full p-6 text-slate-700">
        <ChatMessages />
      </ScrollArea>
    </ChatProvider>
  );
}

export default ThreadView;
