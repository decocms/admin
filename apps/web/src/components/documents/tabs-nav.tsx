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
    <Tabs
      value={active}
      onValueChange={handleChange}
      variant="underline"
      className="w-full"
    >
      <TabsList variant="underline">
        <TabsTrigger value="documents" variant="underline">
          Documents
        </TabsTrigger>
        <TabsTrigger value="prompts" variant="underline">
          Prompts (Legacy)
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default DocumentsTabs;
