import { memo, useCallback } from "react";
import {
  useWorkflowStepDefinition,
  useWorkflowActions,
  useExecuteDraft,
} from "../../../stores/workflows/hooks.ts";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "sonner";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

interface StepExecuteEditorProps {
  stepName: string;
}

export const StepExecuteEditor = memo(function StepExecuteEditor({
  stepName,
}: StepExecuteEditorProps) {
  const stepDefinition = useWorkflowStepDefinition(stepName);
  const draft = useExecuteDraft(stepName);
  const { updateStep, setExecuteDraft, clearExecuteDraft } =
    useWorkflowActions();

  // Current value = draft OR saved value
  const currentValue = draft ?? stepDefinition?.execute ?? "";

  // isDirty = draft exists and differs from saved value
  const isDirty = draft !== undefined && draft !== stepDefinition?.execute;

  const handleChange = useCallback(
    (value: string) => {
      setExecuteDraft(stepName, value);
    },
    [stepName, setExecuteDraft],
  );

  const handleSave = useCallback(() => {
    if (!stepDefinition) {
      toast.error("Step definition not found");
      return;
    }

    updateStep(stepName, {
      def: {
        ...stepDefinition,
        execute: currentValue,
      },
    });

    clearExecuteDraft(stepName);
    toast.success("Execute code updated");
  }, [stepDefinition, stepName, currentValue, updateStep, clearExecuteDraft]);

  const handleReset = useCallback(() => {
    clearExecuteDraft(stepName);
  }, [stepName, clearExecuteDraft]);

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
      <div className="relative space-y-2">
        <CodeMirror
          value={currentValue}
          onChange={handleChange}
          extensions={[javascript({ jsx: true, typescript: true })]}
          theme={oneDark}
          height="300px"
          className="text-sm border border-border rounded-lg overflow-hidden"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            searchKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Export a default async function:{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              (input, ctx) =&gt; Promise&lt;output&gt;
            </code>
          </p>
          <p>
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
