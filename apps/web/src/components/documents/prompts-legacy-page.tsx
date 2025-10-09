import { lazy, Suspense } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { DocumentsTabs } from "./tabs-nav.tsx";

// Import the legacy prompts list component
const PromptsListLegacy = lazy(() => import("../prompts/list/list.tsx"));

export default function PromptsLegacyPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 pb-0">
        <DocumentsTabs active="prompts" />
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        }
      >
        <PromptsListLegacy />
      </Suspense>
    </div>
  );
}
