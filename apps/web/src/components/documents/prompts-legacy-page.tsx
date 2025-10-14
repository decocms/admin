import { lazy } from "react";
import { TabbedPageLayout } from "../common/tabbed-page-layout.tsx";

const PromptsListLegacy = lazy(() => import("../prompts/list/list.tsx"));

export default function PromptsLegacyPage() {
  return (
    <TabbedPageLayout
      component={PromptsListLegacy}
      title="Documents"
      tabs={[
        { id: "all", label: "All", path: "/documents" },
        {
          id: "prompts",
          label: "Prompts (Legacy)",
          path: "/documents/prompts",
        },
      ]}
      getActiveTab={(pathname) =>
        pathname.includes("/documents/prompts") ? "prompts" : "all"
      }
      viewModeKey="prompts"
    />
  );
}
