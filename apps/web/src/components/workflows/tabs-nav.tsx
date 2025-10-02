import { Tabs, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

type WorkflowsTab = "workflows" | "runs" | "triggers";

type WorkflowsTabsProps = {
  active: WorkflowsTab;
};

export function WorkflowsTabs({ active }: WorkflowsTabsProps) {
  const navigateWorkspace = useNavigateWorkspace();

  function handleChange(next: string) {
    if (next === active) {
      return;
    }

    switch (next) {
      case "workflows":
        navigateWorkspace("/workflows");
        break;
      case "runs":
        navigateWorkspace("/workflows/runs");
        break;
      case "triggers":
        navigateWorkspace("/workflows/triggers");
        break;
      default:
        break;
    }
  }

  return (
    <Tabs value={active} onValueChange={handleChange} className="w-full">
      <TabsList className="h-9 gap-2 bg-muted/60 px-2 mb-2">
        <TabsTrigger value="workflows" className="px-4">
          Workflows
        </TabsTrigger>
        <TabsTrigger value="runs" className="px-4">
          Runs
        </TabsTrigger>
        <TabsTrigger value="triggers" className="px-4">
          Triggers
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default WorkflowsTabs;
