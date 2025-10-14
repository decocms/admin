import { Tabs, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

type AgentsTab = "agents" | "threads";

type AgentsTabsProps = {
  active: AgentsTab;
};

export function AgentsTabs({ active }: AgentsTabsProps) {
  const navigateWorkspace = useNavigateWorkspace();

  function handleChange(next: string) {
    if (next === active) {
      return;
    }

    if (next === "agents") {
      navigateWorkspace("/agents");
      return;
    }

    if (next === "threads") {
      navigateWorkspace("/agents/threads");
    }
  }

  return (
    <Tabs
      value={active}
      onValueChange={handleChange}
      variant="underline"
      className="w-full"
    >
      <TabsList variant="underline">
        <TabsTrigger value="agents" variant="underline">
          Agents
        </TabsTrigger>
        <TabsTrigger value="threads" variant="underline">
          Threads
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default AgentsTabs;
