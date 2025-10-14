/**
 * WorkflowLayout - Clean workflow builder with floating toolbar
 */

import { useState, useRef } from "react";
import { WorkflowTabs } from "./ui/workflow-tabs";
import { WorkflowToolbar } from "./ui/workflow-toolbar";
import { WorkflowStepsPreview } from "./ui/workflow-steps-preview";
import { ToolsDropdown } from "./ui/tools-dropdown";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { WorkflowCanvas, type WorkflowCanvasRef } from "./canvas";

const tabs = [
  { id: "editor", label: "Editor", icon: "edit" },
  { id: "code", label: "Code", icon: "code" },
  { id: "input", label: "Input", icon: "keyboard" },
];

export function WorkflowLayout() {
  const [activeTab] = useState("editor");
  const [executionPanelOpen, setExecutionPanelOpen] = useState(false);
  const canvasRef = useRef<WorkflowCanvasRef>(null);

  const leftButtons = [
    {
      id: "tools",
      icon: "build",
      label: "Tools",
      hoverDropdown: (
        <ToolsDropdown
          items={[]}
          isLoading={false}
          onItemClick={(item) => {
            console.log("🔧 Tool clicked:", item);
            // Could add functionality to insert tool in current step
          }}
        />
      ),
    },
    {
      id: "flash",
      icon: "flash_on",
      label: "Execution Monitor",
      onClick: () => {
        console.log(
          "🔥 Flash button clicked, toggling panel:",
          !executionPanelOpen,
        );
        setExecutionPanelOpen(!executionPanelOpen);
      },
    },
  ];

  const centerButtons = [
    {
      id: "prev",
      icon: "chevron_left",
      label: "Previous step",
      onClick: () => {
        if (activeTab === "editor") {
          canvasRef.current?.centerOnPrev();
        } else {
          void 0;
        }
      },
      disabled: false,
    },
    {
      id: "play",
      icon: "play_arrow",
      label: "Run workflow",
      variant: "primary" as const,
      onClick: () => void 0,
      disabled: false,
    },
    {
      id: "next",
      icon: "chevron_right",
      label: "Next step",
      onClick: () => {
        if (activeTab === "editor") {
          canvasRef.current?.centerOnNext();
        } else {
          void 0;
        }
      },
      disabled: false,
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Tabs at top */}
      <WorkflowTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={() => void 0}
      />

      {/* Main Content Area */}
      <div className="flex-1 relative">
        {activeTab === "editor" && (
          <div className="absolute inset-0">
            <WorkflowCanvas ref={canvasRef} />
          </div>
        )}
      </div>

      {/* Floating Toolbar at bottom */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <WorkflowToolbar
          leftButtons={[
            ...leftButtons,
            {
              id: "settings",
              icon: "settings",
              label: "Settings",
              dropdown: (
                <ResponsiveDropdown>
                  <ResponsiveDropdownTrigger asChild>
                    <button
                      type="button"
                      aria-label="Settings"
                      className="flex items-center justify-center rounded-xl shrink-0 size-8 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <span
                        className="material-symbols-outlined text-muted-foreground"
                        style={{ fontSize: "20px" }}
                      >
                        settings
                      </span>
                    </button>
                  </ResponsiveDropdownTrigger>
                  <ResponsiveDropdownContent
                    align="end"
                    className="w-fit bg-popover/95 backdrop-blur-sm"
                  >
                    <ResponsiveDropdownItem onClick={() => void 0}>
                      <span
                        className="material-symbols-outlined mr-2"
                        style={{ fontSize: "16px" }}
                      >
                        download
                      </span>
                      Export
                    </ResponsiveDropdownItem>
                    <ResponsiveDropdownItem onClick={() => void 0}>
                      <span
                        className="material-symbols-outlined mr-2"
                        style={{ fontSize: "16px" }}
                      >
                        upload
                      </span>
                      Import
                    </ResponsiveDropdownItem>
                    <ResponsiveDropdownSeparator />
                    <ResponsiveDropdownItem
                      onClick={() => void 0}
                      className="text-destructive focus:text-destructive"
                    >
                      <span
                        className="material-symbols-outlined mr-2"
                        style={{ fontSize: "16px" }}
                      >
                        refresh
                      </span>
                      Reset
                    </ResponsiveDropdownItem>
                  </ResponsiveDropdownContent>
                </ResponsiveDropdown>
              ),
            },
          ]}
          centerButtons={centerButtons}
          rightContent={
            <WorkflowStepsPreview
              steps={[]}
              activeStepId={undefined}
              onStepClick={(_stepId) => {
                const index = 0;
                if (index !== undefined) {
                  if (activeTab === "editor") {
                    canvasRef.current?.centerOnStep(index);
                  } else {
                    void 0;
                  }
                }
              }}
              onAddStep={() => void 0}
            />
          }
        />
      </div>
    </div>
  );
}
