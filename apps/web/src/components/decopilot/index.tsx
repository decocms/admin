import { WELL_KNOWN_AGENTS } from "@deco/sdk";
import { DockviewApi } from "dockview-react";
import { useState } from "react";
import { MainChat } from "../agent/chat.tsx";
import { AgentProvider } from "../agent/provider.tsx";
import { useViewAdditionalTools } from "./use-view-additional-tools.ts";
import { useAppAdditionalTools } from "./use-app-additional-tools.ts";

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
    maximumWidth: 512,
  });

  return true;
};

export function DecopilotChat() {
  const [threadId, _setThreadId] = useState(() => crypto.randomUUID());
  const viewAdditionalTools = useViewAdditionalTools();
  const appAdditionalTools = useAppAdditionalTools();

  return (
    <div className="flex flex-col h-full">
      <AgentProvider
        key={WELL_KNOWN_AGENTS.decopilotAgent.id}
        agentId={WELL_KNOWN_AGENTS.decopilotAgent.id}
        threadId={threadId}
        additionalTools={{
          ...viewAdditionalTools,
          ...appAdditionalTools,
        }}
        chatOverrides={{}}
        uiOptions={{
          showThreadTools: false,
          showModelSelector: true,
          showThreadMessages: false,
          showAgentVisibility: false,
          showEditAgent: false,
        }}
      >
        <div className="h-full">
          <MainChat />
        </div>
      </AgentProvider>
    </div>
  );
}
DecopilotChat.displayName = "DefaultChat";

export function DecopilotTabs() {
  return null; //<div>display threads in here</div>;
}
DecopilotTabs.displayName = "DefaultChatTabComponent";
