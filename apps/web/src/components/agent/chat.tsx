import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";
import { ChatHeader } from "./ChatHeader.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
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
};

function Conversation(props: Props) {
  const params = useParams();
  const [searchParams] = useSearchParams();

  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  const threadId = useMemo(
    () => props.threadId || params.threadId,
    [props.threadId, params.threadId],
  );

  const message = searchParams.get("message");

  if (!agentId || !threadId) {
    return <div>Agent not found</div>;
  }

  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <ChatProvider
        agentId={agentId}
        threadId={threadId}
        initialMessage={message
          ? { role: "user", content: message }
          : undefined}
      >
        <DockedPageLayout
          main={MAIN}
          tabs={COMPONENTS}
          key={agentId + threadId}
        />
      </ChatProvider>
    </Suspense>
  );
}

export default Conversation;
