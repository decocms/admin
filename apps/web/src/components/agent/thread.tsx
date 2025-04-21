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

  return (
    <ChatProvider agentId={agentId} threadId={threadId}>
      <ChatHeader />
      <ChatMessages />
    </ChatProvider>
  );
}

export default ThreadView;
