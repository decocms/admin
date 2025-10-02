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
    <Tabs value={active} onValueChange={handleChange} className="w-full">
      <TabsList className="h-9 gap-2 bg-muted/60 px-2 mb-2">
        <TabsTrigger value="agents" className="px-4">
          Agents
        </TabsTrigger>
        <TabsTrigger value="threads" className="px-4">
          Threads
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default AgentsTabs;
