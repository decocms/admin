import { useMemo } from "react";
import { useParams } from "react-router";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";
import AgentSettings from "../settings/index.tsx";
import { AgentHeader } from "./DetailHeader.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";

interface Props {
  agentId?: string;
}

const MAIN = {
  header: AgentHeader,
  main: ChatMessages,
  footer: ChatInput,
};

const COMPONENTS = {
  chatView: {
    Component: ThreadView,
    title: "Thread",
  },
  settings: {
    Component: AgentSettings,
    initialOpen: true,
    title: "Settings",
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
  },
};

function Agent(props: Props) {
  const params = useParams();

  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    return <div>Agent not found</div>;
  }

  return (
    <ChatProvider agentId={agentId} threadId={agentId}>
      <DockedPageLayout
        main={MAIN}
        tabs={COMPONENTS}
        key={agentId}
      />
    </ChatProvider>
  );
}

export default Agent;
