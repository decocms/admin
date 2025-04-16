import type { Message } from "@ai-sdk/react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useState } from "react";
import { AgentCard } from "./tools/AgentCard.tsx";
import { Preview } from "./tools/Preview.tsx";
import { Picker } from "./Picker.tsx";
import { parseHandoffTool } from "./utils/parse.ts";
import { openPanel, updateParameters } from "../agent/index.tsx";

interface ToolMessageProps {
  toolInvocations: NonNullable<Message["toolInvocations"]>;
  handlePickerSelect: (
    toolCallId: string,
    selectedValue: string,
  ) => Promise<void>;
}

// Tools that have custom UI rendering and shouldn't show in the timeline
const CUSTOM_UI_TOOLS = [
  "RENDER",
  "SHOW_PICKER",
  "CONFIRM",
  "CONFIGURE",
  "AGENT_CREATE",
] as const;
type CustomUITool = typeof CUSTOM_UI_TOOLS[number];

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: "call" | "result" | "error" | "partial-call";
  args?: Record<string, unknown>;
  result?: {
    data?: Record<string, unknown>;
  };
  error?: unknown;
}

function isCustomUITool(toolName: string): toolName is CustomUITool {
  return CUSTOM_UI_TOOLS.includes(toolName as CustomUITool);
}

function ToolStatus(
  { tool, isLast }: { tool: ToolInvocation; isLast: boolean },
) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getIcon = (state: string) => {
    switch (state) {
      case "call":
        return <Spinner size="xs" variant="default" />;
      case "result":
        return <Icon name="check" className="text-slate-500" />;
      case "error":
        return <Icon name="close" className="text-slate-500" />;
      default:
        return "•";
    }
  };

  const getToolName = () => {
    if (tool.toolName.startsWith("HANDOFF_")) {
      return `Delegating to ${parseHandoffTool(tool.toolName)}`;
    }
    return tool.toolName;
  };

  useEffect(() => {
    if (
      tool.state === "result" &&
      tool.result?.data &&
      tool.toolName.startsWith("HANDOFF_")
    ) {
      const { threadId, agentId } = tool.result.data as {
        threadId: string;
        agentId: string;
      };

      const panelId = `chat-${threadId}`;

      openPanel({
        id: panelId,
        component: "chatView",
        title: parseHandoffTool(tool.toolName),
        params: {
          threadId,
          agentId,
          view: "readonly",
          key: `${panelId}-${Date.now()}`,
        },
      });

      updateParameters({
        id: panelId,
        component: "chatView",
        params: {
          threadId,
          agentId,
          view: "readonly",
          key: `${panelId}-${Date.now()}`,
        },
      });
    }
  }, [tool.state]);

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-2">
        <div className="relative flex flex-col items-center min-h-[20px]">
          <div
            className={cn(
              "w-5 h-5 rounded-full border flex items-center justify-center bg-slate-200",
            )}
          >
            {getIcon(tool.state)}
          </div>
          {!isLast && !isExpanded && (
            <div className="w-[1px] h-full bg-slate-200 absolute top-5 left-1/2 transform -translate-x-1/2" />
          )}
        </div>
        <div className="flex-1">
          <button
            type="submit"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="font-medium">
              {getToolName()}
            </span>
            <Icon
              className={cn("text-sm ml-auto", isExpanded && "rotate-90")}
              name="chevron_right"
            />
          </button>

          {isExpanded && (
            <div className="mt-2 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden w-full">
              <pre className="p-4 text-xs whitespace-pre-wrap break-all">
                <code className="text-zinc-100">
                  {JSON.stringify(
                    {
                      toolName: tool.toolName,
                      state: tool.state,
                      args: tool.args,
                      result: tool.result,
                      error: tool.error,
                    },
                    null,
                    2,
                  ).replace(/"(\w+)":/g, '"$1":')}
                </code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomToolUI({
  tool,
  handlePickerSelect,
}: {
  tool: ToolInvocation;
  handlePickerSelect: ToolMessageProps["handlePickerSelect"];
}) {
  if (tool.state !== "result" || !tool.result?.data) return null;

  switch (tool.toolName) {
    case "RENDER": {
      return (
        <Preview
          content={tool.result.data.content as "url" | "html"}
          title={tool.result.data.title as string}
        />
      );
    }
    case "CONFIGURE":
    case "AGENT_CREATE": {
      return (
        <div className="animate-in slide-in-from-bottom duration-300">
          <AgentCard
            id={tool.result.data.id as string}
            name={tool.result.data.name as string}
            description={tool.result.data.description as string}
            avatar={tool.result.data.avatar as string}
            displayLink={tool.toolName === "AGENT_CREATE"}
          />
        </div>
      );
    }
    case "SHOW_PICKER":
    case "CONFIRM": {
      const options = (tool.result.data.options as string[]).map((option) => ({
        id: option,
        label: option,
        value: option,
      }));
      return (
        <Picker
          question={tool.result.data.question as string}
          options={options}
          onSelect={(value) => handlePickerSelect(tool.toolCallId, value)}
        />
      );
    }
    default: {
      return null;
    }
  }
}

export function ToolMessage(
  { toolInvocations, handlePickerSelect }: ToolMessageProps,
) {
  // Separate tools into timeline tools and custom UI tools
  const timelineTools: ToolInvocation[] = [];
  const customUITools: ToolInvocation[] = [];

  toolInvocations.forEach((tool: ToolInvocation) => {
    if (isCustomUITool(tool.toolName)) {
      customUITools.push(tool);
    } else {
      timelineTools.push(tool);
    }
  });

  return (
    <div className="w-full space-y-4">
      {/* Timeline tools */}
      {timelineTools.length > 0 && (
        <div className="flex flex-col gap-2 w-full p-4 border border-slate-200 rounded-2xl">
          {timelineTools.map((tool, index) => (
            <ToolStatus
              key={tool.toolCallId}
              tool={tool}
              isLast={index === timelineTools.length - 1}
            />
          ))}
        </div>
      )}

      {/* Custom UI tools */}
      {customUITools.map((tool) => (
        <CustomToolUI
          key={tool.toolCallId}
          tool={tool}
          handlePickerSelect={handlePickerSelect}
        />
      ))}
    </div>
  );
}
