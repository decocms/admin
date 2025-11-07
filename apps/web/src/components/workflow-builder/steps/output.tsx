import { EMPTY_VIEWS } from "../../../stores/workflows/hooks.ts";
import { useCallback, useMemo } from "react";
import { JsonViewer } from "../../chat/json-viewer";
import { ViewDialogTrigger } from "../../workflows/workflow-step-card";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { asUserMessage, useAgenticChat } from "../../chat/provider.tsx";

function deepParse(value: unknown, depth = 0): unknown {
  if (typeof value !== "string") {
    return value;
  }

  // Try to parse the string as JSON
  try {
    if (depth > 8) return value;
    const parsed = JSON.parse(value);
    return deepParse(parsed, depth + 1);
  } catch {
    // If parsing fails, check if it looks like truncated JSON
    const trimmed = value.trim();
    const withoutTruncation = trimmed.replace(/\s*\[truncated output]$/i, "");
    if (withoutTruncation.startsWith("{") && !withoutTruncation.endsWith("}")) {
      // Truncated JSON object - try to fix it
      try {
        let fixed = withoutTruncation;
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          fixed += '"';
        }
        // Add closing brace
        fixed += "}";
        const parsed = JSON.parse(fixed);
        return parsed;
      } catch {
        // If fix didn't work, return as string
        return value;
      }
    }
    if (withoutTruncation.startsWith("[") && !withoutTruncation.endsWith("]")) {
      try {
        const fixed = withoutTruncation;
        const parsed = JSON.parse(fixed + "]");
        return parsed;
      } catch {
        return value;
      }
    }
    // Not truncated JSON or couldn't fix, return as string
    return value;
  }
}

interface StepOutputProps {
  output: unknown;
  views?: readonly string[];
}

export function StepOutput({ output, views = EMPTY_VIEWS }: StepOutputProps) {
  if (output === undefined || output === null) return null;

  const parsedOutput = useMemo(() => deepParse(output), [output]);
  const hasViews = views.length > 0;

  return (
    <div
      className="px-4 pt-4 pb-2 flex flex-col gap-5 relative min-w-0 overflow-hidden"
      style={{
        backgroundImage: hasViews
          ? "linear-gradient(90deg, rgba(245, 245, 245, 0.5) 0%, rgba(245, 245, 245, 0.5) 100%), linear-gradient(90deg, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)"
          : undefined,
        backgroundColor: hasViews ? undefined : "#ffffff",
      }}
    >
      <p className="font-mono text-sm text-muted-foreground uppercase leading-5">
        Execution Result
      </p>

      <div className="flex items-center gap-2">
        {hasViews && (
          <div
            className="flex overflow-x-auto items-center gap-3 rounded-md"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {views.map((view, i) => (
              <ViewDialogTrigger
                key={`${view}-${i}`}
                resourceUri={view}
                output={output}
              />
            ))}
          </div>
        )}
        <CreateViewButton />
      </div>

      <div className="min-w-0 overflow-hidden">
        <JsonViewer data={parsedOutput} maxHeight="400px" defaultView="tree" />
      </div>
    </div>
  );
}

function CreateViewButton() {
  const { sendMessage } = useAgenticChat();

  const handleCreateView = useCallback(() => {
    sendMessage(
      asUserMessage(
        "I'd like to create a new view for this workflow step output. Can you help me set it up?",
      ),
    );
  }, [sendMessage]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs"
      onClick={handleCreateView}
    >
      Create view
      <Icon name="add" size={16} />
    </Button>
  );
}
