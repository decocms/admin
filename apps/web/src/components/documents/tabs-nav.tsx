import { Tabs, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

type DocumentsTab = "documents" | "prompts";

interface DocumentsTabsProps {
  active: DocumentsTab;
}

export function DocumentsTabs({ active }: DocumentsTabsProps) {
  const navigateWorkspace = useNavigateWorkspace();

  function handleChange(next: string) {
    if (next === active) {
      return;
    }

    switch (next) {
      case "documents":
        navigateWorkspace("/documents");
        break;
      case "prompts":
        navigateWorkspace("/documents/prompts");
        break;
      default:
        break;
    }
  }

  return (
    <Tabs value={active} onValueChange={handleChange} className="w-full">
      <TabsList className="h-9 gap-2 bg-muted/60 px-2 mb-2">
        <TabsTrigger value="documents" className="px-4">
          Documents
        </TabsTrigger>
        <TabsTrigger value="prompts" className="px-4">
          Prompts (Legacy)
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default DocumentsTabs;
