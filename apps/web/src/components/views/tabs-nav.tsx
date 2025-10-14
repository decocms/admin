import { Tabs, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

type ViewsTab = "views" | "legacy";

interface ViewsTabsProps {
  active: ViewsTab;
}

export function ViewsTabs({ active }: ViewsTabsProps) {
  const navigateWorkspace = useNavigateWorkspace();

  function handleChange(next: string) {
    if (next === active) {
      return;
    }

    switch (next) {
      case "views":
        navigateWorkspace("/views");
        break;
      case "legacy":
        navigateWorkspace("/views/legacy");
        break;
      default:
        break;
    }
  }

  return (
    <Tabs value={active} onValueChange={handleChange} className="w-full">
      <TabsList className="h-9 gap-2 bg-muted/60 px-2 mb-2">
        <TabsTrigger value="views" className="px-4">
          Views
        </TabsTrigger>
        <TabsTrigger value="legacy" className="px-4">
          Legacy
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default ViewsTabs;
