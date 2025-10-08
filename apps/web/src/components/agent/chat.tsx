import { useAgentData, useFile, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";
import { isFilePath } from "../../utils/path.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import { AgentProvider, useAgent } from "./provider.tsx";

export type WellKnownAgents =
  (typeof WELL_KNOWN_AGENT_IDS)[keyof typeof WELL_KNOWN_AGENT_IDS];

interface Props {
  agentId?: WellKnownAgents;
  threadId?: string;
  showThreadMessages?: boolean;
}

interface MainChatProps {
  showInput?: boolean;
  initialScrollBehavior?: "top" | "bottom";
  className?: string;
  contentClassName?: string;
}

export const MainChat = ({
  showInput = true,
  initialScrollBehavior = "bottom",
  className,
  contentClassName,
}: MainChatProps = {}) => {
  return (
    <div
      className={`w-full flex flex-col ${className ?? "h-[calc(100vh-48px)]"}`}
    >
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages initialScrollBehavior={initialScrollBehavior} />
      </ScrollArea>
      {showInput && (
        <div className="p-2">
          <ChatInput />
        </div>
      )}
    </div>
  );
};

function AgentMetadataUpdater() {
  const { agent } = useAgent();
  const { data: resolvedAvatar } = useFile(
    agent?.avatar && isFilePath(agent.avatar) ? agent.avatar : "",
  );

  // Compute favicon href, favouring resolved file URLs for local files.
  const faviconHref = isFilePath(agent?.avatar)
    ? typeof resolvedAvatar === "string"
      ? resolvedAvatar
      : undefined
    : agent?.avatar;

  useDocumentMetadata({
    title: agent ? `${agent.name} | deco CMS` : undefined,
    favicon: faviconHref,
  });

  return null;
}

function Page(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    return <div>Agent not found</div>;
  }

  const propThreadId = props.threadId || params.threadId;
  const threadId = useMemo(
    () => propThreadId || agentId,
    [propThreadId, agentId],
  );

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

  // Use AgentProvider for all agents (including team agent)
  const isTeamAgent = agentId === WELL_KNOWN_AGENT_IDS.teamAgent;

  // Get agent data for decopilot context
  const { data: agent } = useAgentData(agentId);

  // Prepare decopilot context value for agent chat
  const decopilotContextValue = useMemo(() => {
    if (!agent) return {};

    const rules: string[] = [
      `You are helping with agent chat and conversation. The current agent is "${agent.name}". Focus on operations related to conversation management, message handling, and chat functionality.`,
      `When working with this agent chat (${agent.name}), prioritize operations that help users manage conversations, understand chat history, and interact effectively with the agent. Consider the agent's capabilities and current conversation context when providing assistance.`,
    ];

    return {
      rules,
    };
  }, [agent]);

  return (
    <Suspense
      // This make the react render fallback when changin agent+threadid, instead of hang the whole navigation while the subtree isn't changed
      key={chatKey}
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <DecopilotLayout value={decopilotContextValue}>
        <AgentProvider
          agentId={agentId}
          threadId={threadId}
          uiOptions={{
            showThreadTools: isTeamAgent,
            showThreadMessages: props.showThreadMessages ?? true,
          }}
        >
          <AgentMetadataUpdater />
          <MainChat />
        </AgentProvider>
      </DecopilotLayout>
    </Suspense>
  );
}

export default Page;
