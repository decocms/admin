import { useThreadMessages } from "@deco/sdk";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { ChatHeader } from "./ChatHeader.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
}

function ThreadView({ agentId, threadId }: Props) {
  if (!agentId || !threadId) {
    throw new Error("Missing agentId or threadId");
  }

  const messages = useThreadMessages(agentId, threadId);

  return (
    <ChatProvider
      agentId={agentId}
      threadId={threadId}
      threadMessages={messages.data}
    >
      <ChatHeader />
      <ChatMessages />
    </ChatProvider>
  );
}

export default ThreadView;
