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
    <Tabs
      value={active}
      onValueChange={handleChange}
      variant="underline"
      className="w-full"
    >
      <TabsList variant="underline">
        <TabsTrigger value="workflows" variant="underline">
          Workflows
        </TabsTrigger>
        <TabsTrigger value="runs" variant="underline">
          Runs
        </TabsTrigger>
        <TabsTrigger value="triggers" variant="underline">
          Triggers
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default WorkflowsTabs;
