import { lazy, Suspense } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { ViewsTabs } from "./tabs-nav.tsx";

// Import the legacy views list component
const ViewsListLegacy = lazy(() => import("./list.tsx"));

export default function ViewsLegacyPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 pb-0">
        <ViewsTabs active="legacy" />
      </div>
      <div className="flex-1 flex flex-col">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <ViewsListLegacy />
        </Suspense>
      </div>
    </div>
  );
}
