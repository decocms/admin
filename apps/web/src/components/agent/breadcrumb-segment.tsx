import { AgentVisibility } from "../common/agent-visibility.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { useAgent } from "./provider.tsx";

interface Props {
  variant?: "default" | "summary";
}

export function AgentBreadcrumbSegment({ variant = "default" }: Props) {
  const { agent } = useAgent();

  return (
    <div className="flex items-center gap-2">
      {variant !== "summary" && (
        <AgentAvatar url={agent.avatar} fallback={agent.name} size="xs" />
      )}
      <h1 className="text-sm font-medium tracking-tight text-foreground text-nowrap">
        {agent.name}
      </h1>
      <AgentVisibility agent={agent} />
    </div>
  );
}
