import {
  useCurrentStepTab,
  useCurrentStep,
  useDraftStep,
  useIsAddingStep,
  useTrackingExecutionId,
  useWorkflowActions,
  useCurrentTab,
} from "@/web/stores/workflow";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.js";
import { cn } from "@deco/ui/lib/utils.js";
import { useState } from "react";
import {
  CodeAction,
  SleepAction,
  Step,
  ToolCallAction,
  WaitForSignalAction,
} from "@decocms/bindings/workflow";
import { MonacoCodeEditor } from "../monaco-editor";
import { ConnectionSelector, ItemCard, ToolSelector } from "../tool-selector";
import { Button } from "@deco/ui/components/button.js";
import { ExecutionResult, ToolDetail, useTool } from "../details/tool";
import { CodeXml, GitBranch, Loader2 } from "lucide-react";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { usePollingWorkflowExecution } from "@/web/hooks/workflows/use-workflow-collection-item";

export function WorkflowTabs() {
  const currentTab = useCurrentTab();
  const { setCurrentTab } = useWorkflowActions();
  return (
    <div className="bg-muted border border-border rounded-lg flex">
      <Button
        variant="outline"
        size="xs"
        className={cn(
          "h-7 border-0 text-foreground",
          currentTab !== "steps" && "bg-transparent text-muted-foreground",
        )}
        onClick={() => setCurrentTab("steps")}
      >
        <GitBranch className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="xs"
        className={cn(
          "h-7 border-0 text-foreground",
          currentTab !== "code" && "bg-transparent text-muted-foreground",
        )}
        onClick={() => setCurrentTab("code")}
      >
        <CodeXml className="w-4 h-4" />
      </Button>
    </div>
  );
}

function useStepResult(executionId: string, stepId: string) {
  const { item: pollingExecution } = usePollingWorkflowExecution(executionId);
  return pollingExecution?.step_results.find((s) => s.step_id === stepId);
}

function OutputTabContent({
  executionId,
  stepId,
}: {
  executionId: string;
  stepId: string;
}) {
  const stepResult = useStepResult(executionId, stepId);
  if (!stepResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Loading execution...</p>
      </div>
    );
  }
  return (
    <div className="h-full">
      <ExecutionResult
        placeholder="No output found"
        executionResult={stepResult.output as Record<string, unknown> | null}
      />
    </div>
  );
}

export function StepTabs() {
  const activeTab = useCurrentStepTab();
  const { setCurrentStepTab, updateStep } = useWorkflowActions();
  const currentStep = useCurrentStep();
  const handleTabChange = (tab: "input" | "output" | "action") => {
    setCurrentStepTab(tab);
  };
  const selectedExecutionId = useTrackingExecutionId();

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) =>
        handleTabChange(value as "input" | "output" | "action")
      }
      className="w-1/3 h-full bg-sidebar border-l border-border gap-0"
    >
      <TabsList className="w-full rounded-none bg-transparent p-0 h-10">
        <TabsTrigger
          className={cn(
            "border-0 border-b border-border p-0 h-full rounded-none w-full",
            activeTab === "input" && "border-foreground",
          )}
          value="input"
          onClick={() => setCurrentStepTab("input")}
        >
          Input
        </TabsTrigger>
        {selectedExecutionId && (
          <TabsTrigger
            className={cn(
              "border-0 border-b border-border p-0 h-full rounded-none w-full",
              activeTab === "output" && "border-foreground",
            )}
            value="output"
            onClick={() => setCurrentStepTab("output")}
          >
            Output
          </TabsTrigger>
        )}
        <TabsTrigger
          className={cn(
            "border-0 border-b border-border p-0 h-full rounded-none w-full",
            activeTab === "action" && "border-foreground",
          )}
          value="action"
          onClick={() => setCurrentStepTab("action")}
        >
          Action
        </TabsTrigger>
      </TabsList>
      <TabsContent className="flex-1 h-[calc(100%-40px)]" value={activeTab}>
        {currentStep && activeTab === "output" && selectedExecutionId && (
          <div className="h-full">
            <OutputTabContent
              executionId={selectedExecutionId}
              stepId={currentStep.name}
            />
          </div>
        )}
        {currentStep && activeTab === "input" && (
          <MonacoCodeEditor
            height="100%"
            code={JSON.stringify(currentStep.input ?? {}, null, 2)}
            language="json"
            onSave={(input) => {
              updateStep(currentStep.name, {
                input: JSON.parse(input) as Record<string, unknown>,
              });
            }}
          />
        )}

        {currentStep && activeTab === "action" && (
          <ActionTab step={currentStep} />
        )}
      </TabsContent>
    </Tabs>
  );
}

function ActionTab({
  step,
}: {
  step: Step & {
    action: ToolCallAction | CodeAction | SleepAction | WaitForSignalAction;
  };
}) {
  const { updateStep } = useWorkflowActions();
  if ("toolName" in step.action) {
    return (
      <ToolAction
        key={step.name}
        step={step as Step & { action: ToolCallAction }}
      />
    );
  } else if ("code" in step.action) {
    return (
      <MonacoCodeEditor
        height="100%"
        code={step.action.code}
        language="typescript"
        onSave={(code) => {
          updateStep(step.name, {
            action: { ...step.action, code },
          });
        }}
      />
    );
  } else if ("sleepMs" in step.action || "sleepUntil" in step.action) {
    return (
      <MonacoCodeEditor
        height="100%"
        code={JSON.stringify(step.action, null, 2)}
        language="json"
        onSave={(action) => {
          updateStep(step.name, {
            action: JSON.parse(action) as SleepAction,
          });
        }}
      />
    );
  }
  return null;
}

function ToolAction({ step }: { step: Step & { action: ToolCallAction } }) {
  const connectionId = step.action.connectionId;
  const toolName = step.action.toolName;
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(connectionId ?? null);
  const [isUsingTool, setIsUsingTool] = useState(!!toolName);
  const { updateStep } = useWorkflowActions();
  const currentStep = useCurrentStep();
  const isAddingStep = useIsAddingStep();
  const connections = useConnections();

  const updateStepAction = (newToolName: string | null) => {
    if (isAddingStep) return;
    if (!currentStep?.name) return;
    if (!selectedConnectionId || !newToolName) return;
    setIsUsingTool(true);
    updateStep(currentStep.name, {
      action: {
        ...step.action,
        toolName: newToolName,
        connectionId: selectedConnectionId,
      },
    });
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="">
        {!selectedConnectionId && (
          <ConnectionSelector
            selectedConnectionId={selectedConnectionId}
            onConnectionSelect={(connectionId) => {
              setSelectedConnectionId(connectionId);
            }}
          />
        )}
        {!isUsingTool && selectedConnectionId && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col border-t border-border">
            <div onClick={() => setSelectedConnectionId(null)}>
              <ItemCard
                item={{
                  icon: null,
                  title:
                    connections.find((c) => c.id === selectedConnectionId)
                      ?.title ?? selectedConnectionId,
                }}
                selected={true}
                backButton={true}
              />
            </div>
            <ToolSelector
              selectedConnectionId={selectedConnectionId}
              selectedToolName={toolName}
              onToolNameChange={updateStepAction}
            />
          </div>
        )}
      </div>
      {toolName && isUsingTool && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col border-t border-border">
          <SelectedTool
            selectedToolName={toolName}
            selectedConnectionId={
              selectedConnectionId ?? step.action.connectionId
            }
            input={step.input ?? {}}
            onBack={() => {
              setIsUsingTool(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function jsonSchemaToTypeScript(
  schema: Record<string, unknown>,
  typeName: string = "Output",
): string {
  function schemaToType(s: Record<string, unknown>): string {
    if (!s || typeof s !== "object") return "unknown";

    const type = s.type as string | string[] | undefined;

    if (Array.isArray(type)) {
      return type.map((t) => primitiveToTs(t)).join(" | ");
    }

    switch (type) {
      case "string":
        if (s.enum)
          return (s.enum as string[]).map((e) => `"${e}"`).join(" | ");
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      case "array":
        const items = s.items as Record<string, unknown> | undefined;
        return items ? `${schemaToType(items)}[]` : "unknown[]";
      case "object":
        return objectToType(s);
      default:
        if (s.anyOf)
          return (s.anyOf as Record<string, unknown>[])
            .map(schemaToType)
            .join(" | ");
        if (s.oneOf)
          return (s.oneOf as Record<string, unknown>[])
            .map(schemaToType)
            .join(" | ");
        if (s.allOf)
          return (s.allOf as Record<string, unknown>[])
            .map(schemaToType)
            .join(" & ");
        return "unknown";
    }
  }

  function primitiveToTs(t: string): string {
    switch (t) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      default:
        return "unknown";
    }
  }

  function objectToType(s: Record<string, unknown>): string {
    const props = s.properties as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (!props) return "Record<string, unknown>";

    const required = new Set((s.required as string[]) || []);
    const lines = Object.entries(props).map(([key, value]) => {
      const optional = required.has(key) ? "" : "?";
      const desc = value.description ? `  /** ${value.description} */\n` : "";
      return `${desc}  ${key}${optional}: ${schemaToType(value)};`;
    });

    return `{\n${lines.join("\n")}\n}`;
  }

  return `interface ${typeName} ${schemaToType(schema)}`;
}

function SelectedTool({
  selectedToolName,
  selectedConnectionId,
  input,
  onBack,
}: {
  selectedToolName: string;
  selectedConnectionId: string;
  input: Record<string, unknown>;
  onBack: () => void;
}) {
  const { tool, mcp, connection } = useTool(
    selectedToolName,
    selectedConnectionId,
  );
  const draftStep = useDraftStep();
  const { setDraftStep, updateStep } = useWorkflowActions();
  const currentStep = useCurrentStep();

  const ts = jsonSchemaToTypeScript(
    tool?.outputSchema as Record<string, unknown>,
  );
  console.log(ts);

  const handleInputChange = (input: Record<string, unknown>) => {
    if (draftStep) {
      setDraftStep({
        ...(draftStep ?? {}),
        input: {
          ...(draftStep?.input ?? {}),
          ...input,
        } as Record<string, unknown>,
      } as Step);
    } else {
      if (!currentStep?.name) return;
      updateStep(currentStep.name, {
        input: {
          ...(currentStep?.input ?? {}),
          ...input,
        } as Record<string, unknown>,
      });
    }
  };

  if (!tool || !mcp || !connection) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Loading tool...</p>
      </div>
    );
  }

  return (
    <ToolDetail
      tool={tool}
      mcp={mcp}
      withHeader={false}
      onInputChange={handleInputChange}
      connection={connection}
      onBack={onBack}
      initialInputParams={input}
    />
  );
}
