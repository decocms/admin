import { WELL_KNOWN_AGENTS } from "@deco/sdk";
import { useState } from "react";
import { MainChat } from "../agent/chat.tsx";
import { AgentProvider } from "../agent/provider.tsx";
import { useDecopilotContext } from "./context.tsx";
import { useDecopilotThread } from "./thread-context.tsx";
import { useAppAdditionalTools } from "./use-app-additional-tools.ts";

export const NO_DROP_TARGET = "no-drop-target";

export function DecopilotChat() {
  const [threadId, _setThreadId] = useState(() => crypto.randomUUID());
  const { threadState, clearThreadState } = useDecopilotThread();
  const appAdditionalTools = useAppAdditionalTools();
  const {
    additionalTools: contextTools,
    rules,
    onToolCall,
  } = useDecopilotContext();

  // Merge all additional tools
  const allAdditionalTools = {
    ...appAdditionalTools,
    ...contextTools,
  };

  return (
    <div className="flex flex-col h-full">
      <AgentProvider
        key={threadState.threadId}
        agentId={WELL_KNOWN_AGENTS.decopilotAgent.id}
        threadId={threadId}
        initialInput={threadState.initialMessage ?? undefined}
        autoSend={threadState.autoSend}
        onAutoSendComplete={clearThreadState}
        additionalTools={allAdditionalTools}
        initialRules={rules}
        onToolCall={onToolCall}
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
