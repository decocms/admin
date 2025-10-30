import {
  EMPTY_VIEWS,
  useWorkflowStepData,
} from "../../../stores/workflows/hooks.ts";
import { useMemo } from "react";
import { JsonViewer } from "../../chat/json-viewer";
import { ViewDialogTrigger } from "../../workflows/workflow-step-card";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useDecopilotOpen } from "../../layout/decopilot-layout.tsx";
import { useDecopilotThread } from "../../decopilot/thread-context.tsx";
import { useThreadContext } from "../../decopilot/thread-context-provider.tsx";
import { RuleContextItem, ToolsetContextItem } from "../../chat/types.ts";
import { useCallback } from "react";

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
  stepName: string;
  output: unknown;
  views?: readonly string[];
}

export function StepOutput({
  stepName,
  output,
  views = EMPTY_VIEWS,
}: StepOutputProps) {
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
        <CreateViewButton stepName={stepName} />
      </div>

      <div className="min-w-0 overflow-hidden">
        <JsonViewer data={parsedOutput} maxHeight="400px" defaultView="tree" />
      </div>
    </div>
  );
}

const stepViewRule = ({
  outputSchema,
  stepName,
}: {
  outputSchema: Record<string, unknown>;
  stepName: string;
}) => {
  const text = `Create a new view for the output of the step ${stepName}.
    The view's inputSchema should match the outputSchema of the step.
    The outputSchema is: ${JSON.stringify(outputSchema)}

    After the view is created, add the view URI to the step "views" property.
    `;

  return {
    id: `rule-step-view-${stepName}`,
    type: "rule",
    text,
  } as RuleContextItem;
};

const WORKFLOW_TOOLS = [
  "DECO_WORKFLOW_EDIT_STEP",
  "DECO_RESOURCE_WORKFLOW_READ",
];
const VIEWS_TOOLS = ["DECO_RESOURCE_VIEW_CREATE"];

function CreateViewButton({ stepName }: { stepName: string }) {
  const step = useWorkflowStepData(stepName);
  const { setOpen } = useDecopilotOpen();
  const { setThreadState } = useDecopilotThread();
  const { contextItems, setContextItems } = useThreadContext();

  const workflowsToolset = useMemo(() => {
    const existingToolset = contextItems.find(
      (item) =>
        item.type === "toolset" &&
        item.integrationId === "i:workflows-management",
    );

    if (!existingToolset) {
      return {
        id: "toolset-workflows-management",
        type: "toolset",
        integrationId: "i:workflows-management",
        enabledTools: WORKFLOW_TOOLS,
      } as ToolsetContextItem;
    }

    const enabledTools = (
      existingToolset as ToolsetContextItem
    ).enabledTools.filter((tool) => !WORKFLOW_TOOLS.includes(tool));

    return {
      ...existingToolset,
      enabledTools: [...enabledTools, ...WORKFLOW_TOOLS],
    } as ToolsetContextItem;
  }, [contextItems]);

  const viewsToolset = useMemo(() => {
    const existingToolset = contextItems.find(
      (item) =>
        item.type === "toolset" && item.integrationId === "i:views-management",
    );

    if (!existingToolset) {
      return {
        id: "toolset-views-management",
        type: "toolset",
        integrationId: "i:views-management",
        enabledTools: VIEWS_TOOLS,
      } as ToolsetContextItem;
    }

    const enabledTools = (
      existingToolset as ToolsetContextItem
    ).enabledTools.filter((tool) => !VIEWS_TOOLS.includes(tool));

    return {
      ...existingToolset,
      enabledTools: [...enabledTools, ...VIEWS_TOOLS],
    } as ToolsetContextItem;
  }, [contextItems]);

  const defaultContextItems = useMemo(
    () => [
      stepViewRule({
        outputSchema: step?.definition?.outputSchema ?? {},
        stepName,
      }),
      viewsToolset,
      workflowsToolset,
    ],
    [
      step?.definition?.outputSchema,
      step?.output,
      stepName,
      workflowsToolset,
      viewsToolset,
    ],
  );

  const uniqueContextItems = useMemo(() => {
    // Start with non-toolset items from existing context
    const nonToolsetItems = contextItems.filter(
      (item) => item.type !== "toolset",
    );

    // Merge with default context items, deduplicating by id
    const itemsMap = new Map<
      string,
      RuleContextItem | ToolsetContextItem | (typeof nonToolsetItems)[number]
    >();

    // Add existing items first
    for (const item of nonToolsetItems) {
      if (item.id) {
        itemsMap.set(item.id, item);
      }
    }

    // Add/override with default items (they take precedence for same IDs)
    for (const item of defaultContextItems) {
      if (item.id) {
        itemsMap.set(item.id, item);
      }
    }

    return Array.from(itemsMap.values());
  }, [contextItems, defaultContextItems]);

  const handleCreateView = useCallback(() => {
    setOpen(false);
    const threadId = crypto.randomUUID();
    setContextItems(uniqueContextItems);
    setThreadState({
      threadId,
      initialMessage: `Please, create a view for the step "${stepName}"`,
      autoSend: false,
    });
    setOpen(true);
  }, [stepName, uniqueContextItems, setContextItems, setThreadState, setOpen]);
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
