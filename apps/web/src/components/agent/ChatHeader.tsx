import { AgentNotFoundError, useAgent } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";

interface Props {
  agentId: string;
  mode?: "read-only";
}

export function ChatHeader({ mode }: { mode?: "read-only" }) {
  const { agentId } = useChatContext();

  return (
    <ErrorBoundary
      fallback={<ChatHeader.Fallback />}
      shouldCatch={(e) => e instanceof AgentNotFoundError}
    >
      <Suspense fallback={<ChatHeader.Skeleton />}>
        <ChatHeader.UI agentId={agentId} mode={mode} />
      </Suspense>
    </ErrorBoundary>
  );
}

ChatHeader.Fallback = () => {
  return (
    <div className="flex items-center gap-3 h-10">
      <Icon name="smart_toy" size={16} className="opacity-50" />
      <h1 className="text-sm font-medium tracking-tight opacity-50">
        This agent has been deleted
      </h1>
    </div>
  );
};

ChatHeader.Skeleton = () => {
  return <div className="h-10 w-full" />;
};

ChatHeader.UI = ({ agentId }: Props) => {
  const { data: agent } = useAgent(agentId);

  return (
    <div className="flex items-center gap-3 h-10">
      <div className="w-6 h-6 rounded-xs overflow-hidden flex items-center justify-center">
        <AgentAvatar
          name={agent.name}
          avatar={agent.avatar}
          className="rounded-lg text-xs"
        />
      </div>
      <h1 className="text-sm font-medium tracking-tight">
        {agent.name}
      </h1>
    </div>
  );
};
