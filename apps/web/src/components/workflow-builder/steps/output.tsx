import { EMPTY_VIEWS } from "../../../stores/workflows/hooks.ts";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useMemo, useState } from "react";
import { JsonViewer } from "../../chat/json-viewer";
import { ViewDialogTrigger } from "../../workflows/workflow-step-card";

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
  const [displayMode, setDisplayMode] = useState<"view" | "json">("view");

  if (output === undefined || output === null) return null;

  const parsedOutput = useMemo(() => deepParse(output), [output]);
  const hasViews = views.length > 0;

  return (
    <div className="space-y-3 min-w-0 w-full">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm text-muted-foreground uppercase">
          Output
        </p>
        {hasViews && (
          <div className="flex gap-1 border rounded-md p-0.5">
            <Button
              variant={displayMode === "view" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDisplayMode("view")}
              className="h-7 px-2 text-xs"
            >
              <Icon name="view_list" size={14} className="mr-1" />
              Views
            </Button>
            <Button
              variant={displayMode === "json" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDisplayMode("json")}
              className="h-7 px-2 text-xs"
            >
              <Icon name="code" size={14} className="mr-1" />
              JSON
            </Button>
          </div>
        )}
      </div>

      {hasViews && displayMode === "view" ? (
        <div className="flex flex-wrap gap-2">
          {views.map((view) => (
            <ViewDialogTrigger key={view} resourceUri={view} output={output} />
          ))}
        </div>
      ) : (
        <JsonViewer data={parsedOutput} maxHeight="400px" defaultView="tree" />
      )}
    </div>
  );
}
