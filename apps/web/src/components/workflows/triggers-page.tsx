import { Tabs, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { lazy, Suspense } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useWorkflowTabs } from "./use-workflow-tabs.ts";

const ListTriggers = lazy(() => import("../triggers/list.tsx"));

export default function WorkflowsTriggersPage() {
  const { tabs, activeTab } = useWorkflowTabs();

  return (
    <div className="py-14 px-4 md:py-8 md:px-8 lg:py-16 lg:px-16 space-y-4 md:space-y-6 lg:space-y-8 h-full flex flex-col">
      <div>
        <h1 className="text-xl md:text-2xl font-medium text-foreground mb-4">
          Workflows
        </h1>
        <Tabs value={activeTab} className="w-full">
          <TabsList variant="underline">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                variant="underline"
                onClick={tab.onClick}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 overflow-auto">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <ListTriggers />
        </Suspense>
      </div>
    </div>
  );
}
