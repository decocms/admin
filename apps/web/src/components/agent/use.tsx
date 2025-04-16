import { lazy, useMemo } from "react";
import { useParams } from "react-router";
import { getThreadId } from "../../hooks/thread.ts";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { ChatHeader } from "../chat/ChatHeader.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
}

const AgentPreview = lazy(
  () => import("./preview.tsx"),
);

const ThreadTools = lazy(
  () => import("../chat/ChatTools.tsx"),
);

const TABS = {
  preview: {
    Component: AgentPreview,
    initialOpen: false,
  },
  tools: {
    Component: ThreadTools,
    initialOpen: false,
  },
};

const MAIN = {
  header: ChatHeader,
  main: ChatMessages,
  footer: ChatInput,
};

function Agent(props: Props) {
  const params = useParams();

  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );
  const threadId = useMemo(
    () => getThreadId(props.threadId || params.threadId),
    [props.threadId, params.threadId],
  );

  if (!agentId || !threadId) {
    throw new Error("Agent ID and thread ID are required");
  }

  return (
    <ChatProvider agentId={agentId} threadId={threadId}>
      <DockedPageLayout main={MAIN} tabs={TABS} />
    </ChatProvider>
  );
}

// const handleReady = useCallback((event: DockviewReadyEvent) => {
//   // const params = { agentId, threadId, panels: [] };

//   // const chatPanel = event.api.addPanel({
//   //   id: "chat",
//   //   component: "chat",
//   //   title: "Chat View",
//   //   params,
//   // });

//   // chatPanel.group.locked = "no-drop-target";

//   // let prev: string[] = [];
//   // event.api.onDidLayoutChange(() => {
//   //   const currentPanels = event.api.panels.map((panel) => panel.id);
//   //   if (JSON.stringify(prev) !== JSON.stringify(currentPanels)) {
//   //     prev = currentPanels;
//   //     chatPanel.api.updateParameters({ ...params, panels: currentPanels });
//   //   }
//   // });
// }, [agentId, threadId]);

export default Agent;
