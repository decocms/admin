import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useWorkflowContext } from "../../../contexts/workflow-context.tsx";

export function DeveloperBar() {
  const { state, dispatch } = useWorkflowContext();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleClose = () => {
    dispatch({ type: "TOGGLE_DEV_BAR" });
  };

  return (
    <div
      className={`
        border-t bg-white transition-all duration-300
        ${isCollapsed ? "h-12" : "h-64"}
      `}
    >
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Developer Tools</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1"
          >
            {isCollapsed ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={handleClose} className="p-1">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="h-52 overflow-hidden">
          <Tabs
            value={state.devBarTab}
            onValueChange={(value) =>
              dispatch({
                type: "SET_DEV_TAB",
                payload: value as typeof state.devBarTab,
              })
            }
            className="h-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="state">State</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
            </TabsList>

            <div className="h-40 overflow-auto p-4">
              <TabsContent value="state" className="mt-0">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase">
                    Workflow State
                  </h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(
                      {
                        currentStepIndex: state.currentStepIndex,
                        totalSteps: state.workflow.steps.length,
                        isDirty: state.isDirty,
                        isExecuting: state.isExecuting,
                        executionResults: Object.keys(state.executionResults),
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="config" className="mt-0">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase">
                    Workflow Configuration
                  </h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(
                      {
                        id: state.workflow.id,
                        name: state.workflow.name,
                        description: state.workflow.description,
                        stepsCount: state.workflow.steps.length,
                        hasInputSchema: !!state.workflow.inputSchema,
                        hasOutputSchema: !!state.workflow.outputSchema,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="logs" className="mt-0">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase">
                    Execution Logs
                  </h4>
                  <div className="text-xs font-mono space-y-1">
                    {Object.entries(state.executionResults).map(
                      ([stepId, result]) => (
                        <div key={stepId} className="flex gap-2">
                          <span className="text-gray-500">
                            [{new Date(result.executedAt).toLocaleTimeString()}]
                          </span>
                          <span
                            className={
                              result.error ? "text-red-600" : "text-green-600"
                            }
                          >
                            {stepId}:
                          </span>
                          <span className="text-gray-700">
                            {result.error || "Success"}
                          </span>
                        </div>
                      ),
                    )}
                    {Object.keys(state.executionResults).length === 0 && (
                      <span className="text-gray-400">
                        No execution logs yet
                      </span>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="debug" className="mt-0">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase">
                    Debug Information
                  </h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(
                      {
                        currentStep:
                          state.workflow.steps[state.currentStepIndex]?.id,
                        isEditing: state.isEditing,
                        editingStepId: state.editingStepId,
                        lastSaved: state.lastSaved,
                        error: state.error,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}
