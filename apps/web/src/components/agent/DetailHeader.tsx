import { AgentNotFoundError, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
import { useNavigate } from "react-router";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useChatContext } from "../chat/context.tsx";
import { DockedToggleButton } from "../pageLayout.tsx";

interface Props {
  agentId: string;
}

export function AgentHeader() {
  const { agentId } = useChatContext();

  if (agentId === WELL_KNOWN_AGENT_IDS.teamAgent) {
    return (
      <Container>
        <Icon name="forum" size={16} />
        <h1 className="text-sm font-medium tracking-tight">
          New chat
        </h1>
      </Container>
    );
  }

  return (
    <ErrorBoundary
      fallback={<AgentHeader.Fallback />}
      shouldCatch={(e) => e instanceof AgentNotFoundError}
    >
      <Suspense fallback={<AgentHeader.Skeleton />}>
        <AgentHeader.UI />
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

AgentHeader.UI = () => {
  const navigate = useNavigate();

  return (
    <>
      <Button onClick={() => navigate(-1)} variant="ghost">
        <Icon name="arrow_back" />
        Back
      </Button>
      <div className="flex items-center gap-2 py-1">
        <DockedToggleButton
          id="chat"
          title="Test agent"
          variant="outline"
        >
          <Icon name="chat_bubble" />
          Test agent
        </DockedToggleButton>
        <DockedToggleButton
          id="triggers"
          title="Triggers"
          variant="outline"
        >
          <Icon name="task_alt" />
          Triggers
        </DockedToggleButton>
      </div>
    </>
  );
};

export const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1">
      {children}
    </div>
  );
};
