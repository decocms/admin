import { WELL_KNOWN_AGENTS } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useState } from "react";
import { MainChat } from "../agent/chat.tsx";
import { AgentProvider } from "../agent/provider.tsx";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { useDecopilotContext } from "./context.tsx";
import { useDecopilotThread } from "./thread-context.tsx";
import { useAppAdditionalTools } from "./use-app-additional-tools.ts";

export const NO_DROP_TARGET = "no-drop-target";

export function DecopilotChat() {
  const [threadId, _setThreadId] = useState(() => crypto.randomUUID());
  const { threadState, clearThreadState } = useDecopilotThread();
  const appAdditionalTools = useAppAdditionalTools();
  const { setOpen } = useDecopilotOpen();
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
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex h-10 items-center gap-2 border-b border-border px-2">
        <div className="flex items-center gap-2">
          <img
            src={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
            alt={WELL_KNOWN_AGENTS.decopilotAgent.name}
            className="size-5 rounded-md border border-border"
          />
          <span className="text-sm font-normal text-foreground">
            {WELL_KNOWN_AGENTS.decopilotAgent.name}
          </span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex size-6 items-center justify-center rounded-md hover:bg-accent"
        >
          <Icon name="close" size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Chat Content */}
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
        <MainChat />
      </AgentProvider>
    </div>
  );
}
DecopilotChat.displayName = "DefaultChat";
