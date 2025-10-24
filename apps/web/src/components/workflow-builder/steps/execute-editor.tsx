import { memo, useCallback, useState, useEffect } from "react";
import {
  useWorkflowStepDefinition,
  useWorkflowActions,
} from "../../../stores/workflows/hooks.ts";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "sonner";

interface StepExecuteEditorProps {
  stepName: string;
}

export const StepExecuteEditor = memo(function StepExecuteEditor({
  stepName,
}: StepExecuteEditorProps) {
  const stepDefinition = useWorkflowStepDefinition(stepName);
  const { updateStep } = useWorkflowActions();
  const [executeCode, setExecuteCode] = useState(stepDefinition?.execute || "");
  const [isDirty, setIsDirty] = useState(false);

  // Sync with store when step definition changes
  useEffect(() => {
    if (stepDefinition?.execute !== executeCode && !isDirty) {
      setExecuteCode(stepDefinition?.execute || "");
    }
  }, [stepDefinition?.execute, executeCode, isDirty]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setExecuteCode(e.target.value);
      setIsDirty(true);
    },
    [],
  );

  const handleSave = useCallback(() => {
    if (!stepDefinition) {
      toast.error("Step definition not found");
      return;
    }

    updateStep(stepName, {
      def: {
        ...stepDefinition,
        execute: executeCode,
      },
    });

    setIsDirty(false);
    toast.success("Execute code updated");
  }, [stepDefinition, stepName, executeCode, updateStep]);

  const handleReset = useCallback(() => {
    setExecuteCode(stepDefinition?.execute || "");
    setIsDirty(false);
  }, [stepDefinition?.execute]);

  if (!stepDefinition) {
    return null;
  }

  return (
    <div className="border-b border-base-border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm text-muted-foreground uppercase leading-5">
          Execute Code
        </p>
        {isDirty && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 px-2 text-xs"
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSave}
              className="h-7 px-3 text-xs gap-1"
            >
              <Icon name="check" size={14} />
              Save
            </Button>
          </div>
        )}
      </div>
      <div className="relative">
        <Textarea
          value={executeCode}
          onChange={handleChange}
          className="font-mono text-xs min-h-[300px] resize-y"
          placeholder="Export a default async function..."
          spellCheck={false}
        />
        <div className="mt-2 text-xs text-muted-foreground">
          <p>
            Export a default async function:{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              (input, ctx) =&gt; Promise&lt;output&gt;
            </code>
          </p>
          <p className="mt-1">
            Access tools via{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              ctx.env[integrationId][toolName]()
            </code>
          </p>
        </div>
      </div>
    </div>
  );
});
