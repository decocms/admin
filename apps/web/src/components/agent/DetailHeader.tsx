import { AgentNotFoundError, useAgent } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
import { useNavigate } from "react-router";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";

interface Props {
  agentId: string;
}

export function AgentHeader({ agentId }: Props) {
  return (
    <ErrorBoundary
      fallback={<AgentHeader.Fallback />}
      shouldCatch={(e) => e instanceof AgentNotFoundError}
    >
      <Suspense fallback={<AgentHeader.Skeleton />}>
        <AgentHeader.UI agentId={agentId} />
      </Suspense>
    </ErrorBoundary>
  );
}

AgentHeader.Fallback = () => {
  return (
    <Container>
      <Icon name="smart_toy" size={16} className="opacity-50" />
      <h1 className="text-sm font-medium tracking-tight opacity-50">
        This agent has been deleted
      </h1>
    </Container>
  );
};

AgentHeader.Skeleton = () => {
  return null;
};

AgentHeader.UI = ({ agentId }: Props) => {
  const navigate = useNavigate();
  const { data: agent } = useAgent(agentId);

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => navigate(-1)} variant="ghost" size="icon">
        <Icon name="arrow_back" />
      </Button>
      <AgentAvatar name={agent.name} avatar={agent.avatar} className="w-6 h-6" />
      <h1 className="text-sm font-medium tracking-tight text-slate-700">
        {agent.name}
      </h1>
    </div>
  );
};

export const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1">
      {children}
    </div>
  );
};
