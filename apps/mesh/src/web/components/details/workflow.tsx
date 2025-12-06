import { UNKNOWN_CONNECTION_ID } from "@/tools/client";
import { useCollection, useCollectionItem } from "@/web/hooks/use-collections";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Step, Workflow } from "@decocms/bindings/workflow";
import { useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { ViewActions, ViewLayout, ViewTabs } from "./layout";
import { Button } from "@deco/ui/components/button.tsx";
import { ToolDetail, useTool } from "./tool";

export interface WorkflowDetailsViewProps {
  itemId: string;
  onBack: () => void;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}

export function WorkflowDetailsView({
  itemId,
  onBack,
  onUpdate,
}: WorkflowDetailsViewProps) {
  const { connectionId } = useParams({
    strict: false,
  });

  const collection = useCollection<Workflow>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "workflow",
  );

  const item = useCollectionItem<Workflow>(collection, itemId);

  const {
    handleSubmit,
    formState: { isDirty },
  } = useForm<Workflow>({
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const onSubmit = async (data: Workflow) => {
    await onUpdate(data);
  };

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

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
          onClick={handleSubmit(onSubmit)}
          disabled={!isDirty}
        >
          Save changes
        </Button>
      </ViewActions>

      {/* Main Content */}
        <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex gap-4 items-start">
            {
              item.steps.map((step) => (
                <ToolStep key={step.name} step={step} />
              ))
            }
            </div>
          </div>

    </ViewLayout>
  );
}

function ToolStep({ step }: { step: Step }) {
  const toolName = 'toolName' in step.action ? step.action.toolName : '';
  const connectionId = 'connectionId' in step.action ? step.action.connectionId : UNKNOWN_CONNECTION_ID;
  const { tool, mcp, connection, isLoading } = useTool(toolName, connectionId);
  if (isLoading || !tool) {
    return <div>Loading...</div>;
  }
  return <ToolDetail tool={tool} mcp={mcp} connection={connection} onBack={() => {}} initialInputParams={step.input} />;
}