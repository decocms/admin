import { AgentNotFoundError, useAgent, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Suspense } from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";

export function EmptyState({ agentId }: { agentId: string }) {
  if (agentId === WELL_KNOWN_AGENT_IDS.teamAgent) {
    return (
      <div className="py-10">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="text-2xl font-medium leading-loose text-slate-700">
            What can I help with?
          </div>
          <div className="text-sm font-normal text-slate-500 max-w-[510px] text-center">
            Use this chat to ask questions, generate content, execute tasks or
            <br />
            <span className="italic font-crimson-pro text-base">
              build personalized agents.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={<EmptyState.Fallback />}
      shouldCatch={(e) => e instanceof AgentNotFoundError}
    >
      <Suspense fallback={<EmptyState.Skeleton />}>
        <EmptyState.UI agentId={agentId} />
      </Suspense>
    </ErrorBoundary>
  );
}

EmptyState.Fallback = () => {
  return null;
};

EmptyState.Skeleton = () => {
  return <div>Loading...</div>;
};

EmptyState.UI = ({ agentId }: { agentId: string }) => {
  const { data: agent } = useAgent(agentId);

  return (
    <div className="h-full flex flex-col justify-between py-12">
      <div className="flex flex-col items-center justify-center max-w-[640px] mx-auto p-4 duration-300 transition-all">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center ">
            <AgentAvatar
              name={agent?.name}
              avatar={agent?.avatar}
              className="rounded-xl"
            />
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-medium text-slate-800">
                {agent?.name
                  ? agent.name
                  : "Tell me who I am and how I should be"}
              </h2>
            </div>
            <p className="text-slate-500 mx-6 text-center">
              {agent?.description ?? "The more you share, the better I get."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
