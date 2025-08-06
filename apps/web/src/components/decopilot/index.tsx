import { WELL_KNOWN_AGENTS } from "@deco/sdk";
import { DockviewApi } from "dockview-react";
import { MainChat } from "../agent/chat.tsx";
import { ChatProvider } from "../chat/context.tsx";

export const NO_DROP_TARGET = "no-drop-target";

/**
 * Returns true if the decopilot tab is open, false otherwise.
 */
export const toggleDecopilotTab = (api: DockviewApi) => {
  const group = api.getGroup(NO_DROP_TARGET);

  if (group) {
    api.removeGroup(group);
    return false;
  }

  api.addGroup({
    id: NO_DROP_TARGET,
    locked: NO_DROP_TARGET,
    direction: "right",
  });

  api.addPanel({
    id: DecopilotChat.displayName,
    component: DecopilotChat.displayName,
    title: "Default Chat",
    tabComponent: DecopilotTabs.displayName,
  });

  return true;
};

export function DecopilotChat() {
  return (
    <ChatProvider
      agentId={WELL_KNOWN_AGENTS.decopilotAgent.id}
      threadId={"1"}
      uiOptions={{
        showThreadTools: false,
        showModelSelector: false,
        showThreadMessages: false,
        showAgentVisibility: false,
        showEditAgent: false,
      }}
    >
      <MainChat />
    </ChatProvider>
  );
}
DecopilotChat.displayName = "DefaultChat";

export function DecopilotTabs() {
  return null; //<div>display threads in here</div>;
}
DecopilotTabs.displayName = "DefaultChatTabComponent";
