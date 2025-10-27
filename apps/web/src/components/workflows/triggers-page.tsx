import { Tabs, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { lazy, Suspense, useState } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useWorkflowTabs } from "./use-workflow-tabs.ts";
import { TriggerModal } from "../triggers/trigger-dialog.tsx";

const ListTriggers = lazy(() => import("../triggers/list.tsx"));

export default function WorkflowsTriggersPage() {
  const { tabs, activeTab } = useWorkflowTabs();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        {/* Header Section - sticky horizontally */}
        <div className="sticky left-0 px-4 lg:px-6 xl:px-10 pt-12 pb-4 md:pb-6 lg:pb-8 z-10 bg-background">
          <div className="max-w-[1600px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-xl md:text-2xl font-medium text-foreground">
                Workflows
              </h1>
              <Button
                variant="default"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-9 rounded-xl"
              >
                <Icon name="add" />
                <span className="hidden md:inline">New trigger</span>
              </Button>
            </div>
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
        </div>

        {/* Content Section */}
        <div className="px-4 lg:px-6 xl:px-10">
          <div className="max-w-[1600px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8 pb-8">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              }
            >
              <ListTriggers />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Create Trigger Modal */}
      {isCreateModalOpen && (
        <TriggerModal
          isOpen={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
        />
      )}
    </div>
  );
}
