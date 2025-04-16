import type { Integration } from "@deco/sdk";
import { Integration as IntegrationComponent } from "../toolset/integrations/index.tsx";

interface ToolsetSelectorProps {
  integrations: Integration[];
  currentToolset: Record<string, string[]>;
  setTools: (integrationId: string, toolSet?: string[]) => void;
}

export const getDiffCount = (
  t0: Record<string, string[]>,
  t1: Record<string, string[]>,
) => {
  let count = 0;
  for (const [i0, t0Tools] of Object.entries(t0)) {
    const t1Tools = t1[i0] ?? [];
    count += t0Tools.filter((tool) => !t1Tools.includes(tool)).length;
  }

  for (const [i1, t1Tools] of Object.entries(t1)) {
    const t0Tools = t0[i1] ?? [];
    count += t1Tools.filter((tool) => !t0Tools.includes(tool)).length;
  }

  return count;
};

export function ToolsetSelector({
  integrations,
  currentToolset,
  setTools,
}: ToolsetSelectorProps) {
  return (
    <div className="space-y-2">
      {integrations.map((integration) => (
        <IntegrationComponent
          key={integration.id}
          integration={integration}
          setTools={setTools}
          toolset={currentToolset}
        />
      ))}
    </div>
  );
}
