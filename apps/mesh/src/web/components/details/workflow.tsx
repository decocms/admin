import { createToolCaller, UNKNOWN_CONNECTION_ID } from "@/tools/client";
import { useCollection, useCollectionItem } from "@/web/hooks/use-collections";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  CodeAction,
  type Step,
  ToolCallAction,
  Workflow,
} from "@decocms/bindings/workflow";
import { useParams } from "@tanstack/react-router";
import { ViewActions, ViewLayout, ViewTabs } from "./layout";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { ToolDetail, useTool } from "./tool";
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Avatar } from "@deco/ui/components/avatar.js";
import {
  useConnection,
  useConnections,
} from "@/web/hooks/collections/use-connection";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import { ToolSelector } from "../tool-selector";
import { createContext, useContext, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@deco/ui/components/select.js";
import { Icon } from "@deco/ui/components/icon.js";
import { cn } from "@deco/ui/lib/utils.js";
import { createStore, StoreApi } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import { Textarea } from "@deco/ui/components/textarea.js";
import { MonacoCodeEditor } from "../monaco-editor";
import { ChevronDown, CodeXml, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.js";
import { ScrollArea } from "@deco/ui/components/scroll-area.js";
import { useToolCallMutation } from "@/web/hooks/use-tool-call";
import { useBindingConnections } from "@/web/hooks/use-binding";
export interface WorkflowDetailsViewProps {
  itemId: string;
  onBack: () => void;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}

interface State {
  workflow: Workflow;
  currentStepName: string | undefined;
}

interface Actions {
  setToolAction: (toolAction: ToolCallAction) => void;
  addStep: (step: Step) => void;
  deleteStep: (stepName: string) => void;
  setCurrentStepName: (stepName: string) => void;
  updateStep: (stepName: string, updates: Partial<Step>) => void;
}

interface Store extends State {
  actions: Actions;
}

export const WorkflowStoreContext = createContext<StoreApi<Store> | null>(null);
export const createWorkflowStore = (initialState: State) => {
  return createStore<Store>()(
    persist(
      (set) => ({
        ...initialState,
        actions: {
          setToolAction: (toolAction) =>
            set((state) => ({
              workflow: {
                ...state.workflow,
                steps: state.workflow.steps.map((step) =>
                  "toolName" in step.action &&
                  step.action.toolName !== toolAction.toolName
                    ? { ...step, action: toolAction }
                    : step,
                ),
              },
            })),
          addStep: (step: Step) =>
            set((state) => {
              const existingName = state.workflow.steps.find(
                (s) => s.name === step.name,
              );
              const newName = existingName
                ? `${step.name} ${
                    parseInt(
                      existingName.name.split(" ").pop() ??
                        Math.random().toString(36).substring(2, 15),
                    ) + 1
                  }`
                : step.name;
              return {
                workflow: {
                  ...state.workflow,
                  steps: [...state.workflow.steps, { ...step, name: newName }],
                },
              };
            }),
          deleteStep: (stepName) =>
            set((state) => ({
              workflow: {
                ...state.workflow,
                steps: state.workflow.steps.filter(
                  (step) => step.name !== stepName,
                ),
              },
            })),
          setCurrentStepName: (stepName) =>
            set((state) => ({
              ...state,
              currentStepName: stepName,
            })),
          updateStep: (stepName, updates) =>
            set((state) => ({
              ...state,
              workflow: {
                ...state.workflow,
                steps: state.workflow.steps.map((step) =>
                  step.name === stepName ? { ...step, ...updates } : step,
                ),
              },
            })),
        },
      }),
      {
        name: `workflow-store-${encodeURIComponent(
          initialState.workflow.id,
        ).slice(0, 200)}`,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          workflow: state.workflow,
        }),
      },
    ),
  );
};

export function WorkflowStoreProvider({
  children,
  workflow,
}: {
  children: React.ReactNode;
  workflow: Workflow;
}) {
  const [store] = useState(() =>
    createWorkflowStore({
      workflow,
      currentStepName: workflow.steps[0]?.name ?? undefined,
    }),
  );

  return (
    <WorkflowStoreContext.Provider value={store}>
      {children}
    </WorkflowStoreContext.Provider>
  );
}

export function useWorkflowStore<T>(
  selector: (state: Store) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const store = useContext(WorkflowStoreContext);
  if (!store) {
    throw new Error(
      "Missing WorkflowStoreProvider - refresh the page. If the error persists, please contact support.",
    );
  }
  return useStoreWithEqualityFn(store, selector, equalityFn ?? shallow);
}

export function useWorkflowActions() {
  return useWorkflowStore((state) => state.actions);
}

export function WorkflowDetailsView({
  itemId,
  onBack,
}: WorkflowDetailsViewProps) {
  const { connectionId } = useParams({
    strict: false,
  });

  const collection = useCollection<Workflow>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "workflow",
  );

  const item = useCollectionItem<Workflow>(collection, itemId);

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <WorkflowStoreProvider workflow={item}>
      <WorkflowDetails
        onBack={onBack}
        onUpdate={(updates) =>
          collection
            .update(itemId, (draft) => {
              Object.assign(draft, updates);
            })
            .isPersisted.promise.then(() => {})
        }
      />
    </WorkflowStoreProvider>
  );
}

interface WorkflowDetailsProps {
  onBack: () => void;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}

function useCurrentStep() {
  const currentStepName = useWorkflowStore((state) => state.currentStepName);
  const workflow = useWorkflowStore((state) => state.workflow);
  return workflow.steps.find((step) => step.name === currentStepName);
}

function useWorkflowSteps() {
  const workflow = useWorkflowStore((state) => state.workflow);
  return workflow.steps;
}

function ToolStep({ step }: { step: Step & { action: ToolCallAction } }) {
  const connection = useConnection(step.action.connectionId);
  return (
    <StepCard
      step={step}
      icon={
        <Avatar
          url={connection?.icon ?? undefined}
          className="size-8"
          fallback={step.name}
        />
      }
    />
  );
}

export function WorkflowDetails({ onBack, onUpdate }: WorkflowDetailsProps) {
  const [activeTab, setActiveTab] = useState<"input" | "output" | "action">(
    "action",
  );
  const { addStep } = useWorkflowActions();
  const steps = useWorkflowSteps();
  const currentStep = useCurrentStep();
  const { updateStep } = useWorkflowActions();
  const connections = useConnections();
  const bindingConnections = useBindingConnections(connections, "WORKFLOWS");
  const toolCaller = useMemo(
    () => createToolCaller(bindingConnections[0]?.id ?? undefined),
    [bindingConnections],
  );
  const workflow = useWorkflowStore((state) => state.workflow);
  const { mutateAsync: startWorkflow, isPending: isWorkflowStartPending } =
    useToolCallMutation({
      toolCaller,
      toolName: "WORKFLOW_START",
    });

  const handleTabChange = (tab: "input" | "output" | "action") => {
    setActiveTab(tab);
  };

  const handleRunWorkflow = async () => {
    const result = await startWorkflow({
      workflowId: workflow.id,
      input: {},
    });
    console.log(result);
  };

  const handleNewStep = () => {
    addStep({
      name: `Step ${steps.length + 1}`,
      action: {
        code: `
        interface Input {
          name: string;
        }
        interface Output {
          name: string;
        }

        export default async function(input: Input): Promise<Output> { 
          return {
            name: input.name,
          };
        }`,
      },
    });
  };

  return (
    <ViewLayout onBack={onBack}>
      <ViewTabs>
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
      </ViewTabs>

      <ViewActions>
        <Button
          className="bg-[#d0ec1a] text-[#07401a] hover:bg-[#d0ec1a]/90 h-7 text-xs font-medium"
          onClick={handleRunWorkflow}
          disabled={isWorkflowStartPending}
        >
          {isWorkflowStartPending ? (
            <Spinner size="xs" />
          ) : (
            <Icon name="play_arrow" className="w-4 h-4" />
          )}
          Run workflow
        </Button>
        <Button
          className="bg-[#d0ec1a] text-[#07401a] hover:bg-[#d0ec1a]/90 h-7 text-xs font-medium"
          onClick={() => onUpdate(workflow)}
        >
          Save changes
        </Button>
      </ViewActions>

      {/* Main Content */}
      <div className="flex w-full h-full">
        <div className="flex gap-2 items-start w-2/3 h-full py-2">
          <ScrollArea hideScrollbar className="w-1/3 mx-auto h-full ">
            {steps.map((step, index) => (
              <div key={step.name + index} className="flex flex-col gap-2">
                {"toolName" in step.action ? (
                  <ToolStep
                    key={step.name}
                    step={step as Step & { action: ToolCallAction }}
                  />
                ) : (
                  <StepCard
                    key={step.name}
                    step={step as Step & { action: CodeAction }}
                    icon={
                      <div className="h-8 w-8 bg-primary text-primary-foreground flex items-center justify-center rounded-lg">
                        <CodeXml className="w-4 h-4" />
                      </div>
                    }
                  />
                )}
                <div className="flex flex-col gap-2 items-center justify-center mb-2">
                  <div className="w-[2px] h-10 bg-border" />
                  <Button
                    className="border-primary border h-6 w-6"
                    variant="ghost"
                    size="xs"
                    onClick={handleNewStep}
                  >
                    <Plus className="w-3 h-3 text-primary-foreground" />
                  </Button>
                  {index < steps.length - 1 && (
                    <div className="relative">
                      <div className="w-[2px] h-10 bg-border" />
                      <ChevronDown className="w-5 h-5 text-border absolute -bottom-2.5 left-1/2 -translate-x-1/2" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            handleTabChange(value as "input" | "output" | "action")
          }
          className="w-1/3 h-full bg-sidebar border-l border-border"
        >
          <TabsList className="w-full rounded-none bg-transparent p-0">
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
          <TabsContent value={activeTab} className="h-full overflow-scroll">
            {currentStep &&
              activeTab === "action" &&
              "toolName" in currentStep.action && (
                <ToolAction
                  step={currentStep as Step & { action: ToolCallAction }}
                />
              )}
            {currentStep && activeTab === "input" && (
              <Textarea
                value={JSON.stringify(currentStep.input ?? {}, null, 2)}
                className="w-full h-full"
                onChange={(e) => {
                  try {
                    updateStep(currentStep.name, {
                      input: JSON.parse(e.target.value) as Record<
                        string,
                        unknown
                      >,
                    });
                  } catch (error) {
                    console.error(error);
                  }
                }}
              />
            )}
            {currentStep &&
              activeTab === "action" &&
              "code" in currentStep.action && (
                <MonacoCodeEditor
                  code={currentStep.action.code}
                  language="typescript"
                />
              )}
          </TabsContent>
        </Tabs>
      </div>
    </ViewLayout>
  );
}

function StepMenu({ step }: { step: Step }) {
  const { setCurrentStepName, deleteStep } = useWorkflowActions();
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Icon name="more_horiz" className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setCurrentStepName(step.name)}>
            <Icon name="edit" className="w-4 h-4 text-muted-foreground" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => deleteStep(step.name)}>
            <Icon name="delete" className="w-4 h-4 text-muted-foreground" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const StepCard = ({ step, icon }: { step: Step; icon: React.ReactNode }) => {
  return (
    <Card className="w-full border px-4 py-[18px]">
      <CardHeader className="flex items-center justify-between gap-2 p-0">
        <div className="flex flex-1 items-center gap-2">
          {icon}
          <CardTitle className="p-0 text-base font-medium">
            {step.name}
          </CardTitle>
        </div>
        <CardAction>
          <StepMenu step={step} />
        </CardAction>
      </CardHeader>
    </Card>
  );
};
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
          <ToolStep step={step as Step & { action: ToolCallAction }} />
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
