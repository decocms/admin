import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { TabScrollArea } from "../pageLayout.tsx";
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
        <ChatHeader mode="read-only" />
      </div>
      <TabScrollArea>
        <ChatMessages />
      </TabScrollArea>
    </ChatProvider>
  );
}

export default ThreadView;
