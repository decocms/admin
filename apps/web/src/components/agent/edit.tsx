import { Icon } from "@deco/ui/components/icon.tsx";
import { useMemo } from "react";
import { useParams } from "react-router";
import { ChatHeader } from "../chat/ChatHeader.tsx";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { DockedPageLayout, DockedToggleButton } from "../pageLayout.tsx";
import { SettingsProvider } from "../settings/context.tsx";
import AgentSettings from "../settings/index.tsx";
import AgentPreview from "./preview.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
}

const TABS = {
  settings: {
    Component: AgentSettings,
    initialOpen: true,
  },
  preview: {
    Component: AgentPreview,
    initialOpen: false,
  },
};

const MAIN = {
  header: Header,
  main: ChatMessages,
  footer: ChatInput,
};

function Header() {
  return (
    <>
      <ChatHeader />

      <div className="flex items-center gap-2">
        <DockedToggleButton
          id="settings"
          title="Settings"
          variant="outline"
          size="icon"
        >
          <Icon name="tune" />
        </DockedToggleButton>
      </div>
    </>
  );
}

function Agent(props: Props) {
  const params = useParams();

  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    throw new Error("Agent ID is required");
  }

  return (
    <SettingsProvider agentId={agentId}>
      <ChatProvider agentId={agentId} threadId={agentId}>
        <DockedPageLayout main={MAIN} tabs={TABS} />
      </ChatProvider>
    </SettingsProvider>
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
