import {
  useActiveTab,
  useWorkflowActions,
  useCurrentStep,
  useTrackingExecutionId,
} from "@/web/stores/workflow";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@deco/ui/components/tabs.js";
import { Textarea } from "@deco/ui/components/textarea.js";
import { cn } from "@deco/ui/lib/utils.js";
import { useMemo, useState } from "react";
import { ExecutionResult, ToolDetail, useTool } from "../details/tool";
import { useStreamWorkflowExecution } from "../details/workflow-execution";
import { getStepResults, StepCard } from "./steps";
import { UNKNOWN_CONNECTION_ID } from "@/tools/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.js";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@deco/ui/components/select.js";
import {
  Step,
  ToolCallAction,
  CodeAction,
  SleepAction,
  WaitForSignalAction,
} from "@decocms/bindings/workflow";
import { CodeXml } from "lucide-react";
import { Icon } from "@deco/ui/components/icon.js";
import { MonacoCodeEditor } from "../monaco-editor";
import { ToolSelector } from "../tool-selector";
import { Button } from "@deco/ui/components/button.js";
import { ScrollArea } from "@deco/ui/components/scroll-area.js";

export function WorkflowTabs() {
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="h-7 bg-muted text-foreground font-normal"
      >
        Steps
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-muted-foreground font-normal"
        disabled={true}
      >
        Triggers
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-muted-foreground font-normal"
        disabled={true}
      >
        Advanced
      </Button>
    </>
  );
}

export function StepTabs() {
  const activeTab = useActiveTab();
  const { setActiveTab, updateStep } = useWorkflowActions();
  const currentStep = useCurrentStep();
  const handleTabChange = (tab: "input" | "output" | "action") => {
    setActiveTab(tab);
  };

  const trackingExecutionId = useTrackingExecutionId();
  const { data } = useStreamWorkflowExecution(trackingExecutionId);

  const executionResult = useMemo(
    () =>
      getStepResults(
        currentStep?.name ?? "",
        data?.item?.step_results,
        data?.item?.stream_chunks,
      )?.[0]?.output as Record<string, unknown> | null,
    [data?.item?.step_results, data?.item?.stream_chunks, currentStep?.name],
  );
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) =>
        handleTabChange(value as "input" | "output" | "action")
      }
      className="w-1/3 h-full bg-sidebar border-l border-border"
    >
      <TabsList className="w-full rounded-none bg-transparent p-0 h-10">
        <TabsTrigger
          className={cn(
            "border-0 border-b border-border p-0 h-full rounded-none w-full",
            activeTab === "input" && "border-foreground",
          )}
          value="input"
          onClick={() => setActiveTab("input")}
        >
          Input
        </TabsTrigger>
        <TabsTrigger
          className={cn(
            "border-0 border-b border-border p-0 h-full rounded-none w-full",
            activeTab === "output" && "border-foreground",
          )}
          value="output"
          onClick={() => setActiveTab("output")}
        >
          Output
        </TabsTrigger>
        <TabsTrigger
          className={cn(
            "border-0 border-b border-border p-0 h-full rounded-none w-full",
            activeTab === "action" && "border-foreground",
          )}
          value="action"
          onClick={() => setActiveTab("action")}
        >
          Action
        </TabsTrigger>
      </TabsList>
      <TabsContent className="flex-1 h-[calc(100%-40px)]" value={activeTab}>
        {currentStep && activeTab === "output" && (
          <div className="h-full">
            <ExecutionResult
              placeholder="No output found"
              executionResult={executionResult}
            />
          </div>
        )}
        {currentStep && activeTab === "input" && (
          <Textarea
            value={JSON.stringify(currentStep.input ?? {}, null, 2)}
            className="w-full h-full"
            onChange={(e) => {
              try {
                updateStep(currentStep.name, {
                  input: JSON.parse(e.target.value) as Record<string, unknown>,
                });
              } catch (error) {
                console.error(error);
              }
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
    return <ToolAction step={step as Step & { action: ToolCallAction }} />;
  } else if ("code" in step.action) {
    return <MonacoCodeEditor code={step.action.code} language="typescript" />;
  } else if ("sleepMs" in step.action || "sleepUntil" in step.action) {
    return (
      <Textarea
        value={JSON.stringify(step.action, null, 2)}
        className="w-full h-full"
        onChange={(e) => {
          updateStep(step.name, {
            action: JSON.parse(e.target.value) as SleepAction,
          });
        }}
      />
    );
  }
  return null;
}

function ToolAction({ step }: { step: Step & { action: ToolCallAction } }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const connectionId = step.action.connectionId;
  const toolName = step.action.toolName;
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(connectionId ?? null);
  const [selectedToolName, setSelectedToolName] = useState<string | null>(
    toolName ?? null,
  );
  const { setToolAction } = useWorkflowActions();

  return (
    <div className="w-full h-full flex flex-col">
      <Collapsible open={open} className="w-full h-full flex-1">
        <div className="w-full" onClick={() => setOpen(!open)}>
          <Select value={"tool"}>
            <div className="flex items-center gap-2">
              <SelectTrigger showIcon={false}>
                <Icon name="build" className="w-4 h-4 text-muted-foreground" />
              </SelectTrigger>
              <span className="text-sm">Tool</span>
            </div>
            <SelectContent>
              <SelectItem value="tool">
                <Icon name="build" className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Tool</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CollapsibleContent className="w-full">
          <ToolSelector
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedConnectionId={selectedConnectionId}
            onConnectionSelect={setSelectedConnectionId}
            selectedToolName={selectedToolName}
            onToolNameChange={(toolName) => {
              setSelectedToolName(toolName);
              setToolAction({
                toolName: toolName ?? "",
                connectionId: selectedConnectionId ?? UNKNOWN_CONNECTION_ID,
              } as ToolCallAction);
            }}
          />
        </CollapsibleContent>
      </Collapsible>
      <Collapsible open={true} className="w-full flex-1">
        <CollapsibleTrigger className="w-full">
          <StepCard
            step={step as Step & { action: ToolCallAction }}
            icon={<CodeXml className="w-4 h-4" />}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="w-full py-2">
          <SelectedTool step={step} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function SelectedTool({ step }: { step: Step & { action: ToolCallAction } }) {
  const toolName = step.action.toolName;
  const connectionId = step.action.connectionId;
  const { tool, mcp, connection, isLoading } = useTool(toolName, connectionId);
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!tool) {
    return <div>Tool not found</div>;
  }
  return (
    <ToolDetail
      tool={tool}
      mcp={mcp}
      withHeader={false}
      connection={connection}
      onBack={() => {}}
      initialInputParams={step.input}
    />
  );
}
