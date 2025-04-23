import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";
import ThreadSettingsTab from "../settings/chat.tsx";
import { ChatHeader } from "./ChatHeader.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
  disableThreadMessages?: boolean;
}

const MAIN = {
  header: ChatHeader,
  main: ChatMessages,
  footer: ChatInput,
};

const COMPONENTS = {
  chatView: {
    Component: ThreadView,
    title: "Thread",
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
  },
  tools: {
    Component: ThreadSettingsTab,
    title: "Tools",
  },
};

function Conversation(props: Props) {
  const params = useParams();

  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  const threadId = useMemo(
    () => props.threadId || params.threadId,
    [props.threadId, params.threadId],
  );

  if (!agentId || !threadId) {
    return <div>Agent not found</div>;
  }

  const chatKey = agentId + threadId;

  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
      key={chatKey}
    >
      <ChatProvider
        agentId={agentId}
        threadId={threadId}
        disableThreadMessages={props.disableThreadMessages}
      >
        <DockedPageLayout
          main={MAIN}
          tabs={COMPONENTS}
          key={chatKey}
        />
      </ChatProvider>
    </Suspense>
  );
}

export default Conversation;
