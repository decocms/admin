import type { Message } from "@ai-sdk/react";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useMemo, useRef, useState } from "react";
import { Picker } from "./chat-picker.tsx";
import { useAgent } from "../agent/provider.tsx";
import { AgentCard } from "./tools/agent-card.tsx";
import { Preview } from "./tools/render-preview.tsx";
import { HostingAppDeploy } from "./tools/hosting-app-deploy.tsx";
import { formatToolName } from "./utils/format-tool-name.ts";

interface ConfirmOption {
  value: string;
  label: string;
}

interface ToolMessageProps {
  toolInvocations: NonNullable<Message["toolInvocations"]>;
  isLastMessage?: boolean;
}

// Tools that have custom UI rendering and shouldn't show in the timeline
const CUSTOM_UI_TOOLS = [
  "HOSTING_APP_DEPLOY",
  "RENDER",
  "SHOW_PICKER",
  "CONFIRM",
  "CONFIGURE",
  "AGENT_CREATE",
] as const;
type CustomUITool = (typeof CUSTOM_UI_TOOLS)[number];

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: "call" | "result" | "error" | "partial-call";
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: unknown;
}

function isCustomUITool(toolName: string): toolName is CustomUITool {
  return CUSTOM_UI_TOOLS.includes(toolName as CustomUITool);
}

function ToolStatus({
  tool,
  isLast,
  isSingle,
}: {
  tool: ToolInvocation;
  isLast: boolean;
  isSingle: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCopyButton, setShowCopyButton] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const getIcon = (state: string) => {
    switch (state) {
      case "call":
        return <Spinner size="xs" variant="default" />;
      case "result":
        return <Icon name="check" className="text-muted-foreground" />;
      case "error":
        return <Icon name="close" className="text-muted-foreground" />;
      default:
        return "•";
    }
  };

  const getToolName = () => {
    if (tool.toolName.startsWith("AGENT_GENERATE_")) {
      return `Delegating to agent`;
    }
    return formatToolName(tool.toolName);
  };

  const getToolJson = () => {
    return JSON.stringify(
      {
        toolName: tool.toolName,
        state: tool.state,
        args: tool.args,
        result: tool.result,
        error: tool.error,
      },
      null,
      2,
    ).replace(/"(\w+)":/g, '"$1":');
  };

  const onClick = () => {
    setIsExpanded((prev) => {
      const newState = !prev;

      setTimeout(() => {
        if (newState && contentRef.current) {
          contentRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);

      return newState;
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getToolJson());
  };

  return (
    <div
      className={cn(
        "flex flex-col relative",
        isSingle && "p-4 hover:bg-accent rounded-2xl",
      )}
      onClick={isSingle ? onClick : undefined}
      onMouseEnter={() => setShowCopyButton(true)}
      onMouseLeave={() => setShowCopyButton(false)}
    >
      <div className="flex items-start gap-2">
        <button
          type="submit"
          onClick={isSingle ? undefined : onClick}
          className={cn(
            "w-full flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
            !isSingle && "hover:bg-accent rounded-lg p-2",
          )}
        >
          <div className="relative flex flex-col items-center min-h-[20px]">
            <div
              className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center bg-muted",
              )}
            >
              {getIcon(tool.state)}
            </div>
            {!isLast && !isExpanded && (
              <div className="w-[1px] h-[150%] bg-muted absolute top-5 left-1/2 transform -translate-x-1/2" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium truncate max-w-[60vw] md:max-w-full">
                {getToolName()}
              </div>
              <Icon
                className={cn("text-sm ml-auto", isExpanded && "rotate-90")}
                name="chevron_right"
              />
            </div>

            {isExpanded && (
              <div
                ref={contentRef}
                className="text-left mt-2 rounded-lg bg-primary border border-border overflow-hidden w-full relative"
                onClick={(e) => e.stopPropagation()}
              >
                {showCopyButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy();
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
                    title="Copy tool details"
                  >
                    <Icon
                      name="content_copy"
                      className="w-4 h-4 text-muted-foreground"
                    />
                  </Button>
                )}
                <pre
                  className="p-4 text-xs whitespace-pre-wrap break-all overflow-y-auto max-h-[500px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <code className="text-primary-foreground select-text cursor-auto">
                    {getToolJson()}
                  </code>
                </pre>
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

function ImagePrompt({
  prompt,
  isCollapsible = true,
}: {
  prompt: string;
  isCollapsible?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isCollapsible || prompt.length <= 60) {
    return (
      <p className="text-sm text-muted-foreground/80 leading-relaxed break-words whitespace-pre-wrap">
        {prompt}
      </p>
    );
  }

  const truncatedPrompt = prompt.slice(0, 60) + "...";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-2 w-full">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-sm text-muted-foreground/80 hover:text-muted-foreground font-normal justify-start w-full text-left"
          >
            <span className="leading-relaxed break-words flex-1 min-w-0">
              {truncatedPrompt}
            </span>
            <Icon
              name="chevron_right"
              className={cn(
                "ml-2 h-3 w-3 flex-shrink-0 transition-transform",
                isOpen && "rotate-90",
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="text-sm text-muted-foreground/80 leading-relaxed pl-4 border-l-2 border-muted break-words whitespace-pre-wrap">
            {prompt}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function GeneratingStatus() {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="text-foreground relative overflow-hidden">
          <span
            className="relative inline-block font-medium"
            style={{
              background:
                "linear-gradient(90deg, currentColor 0%, rgba(255,255,255,0.8) 50%, currentColor 100%)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 3s ease-in-out infinite",
            }}
          >
            Generating image...
          </span>
        </div>
        <Spinner size="xs" variant="default" />
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `,
        }}
      />
    </>
  );
}

function GenerateImageToolUI({ tool }: { tool: ToolInvocation }) {
  const state = tool.state;
  const prompt = tool.args?.prompt;

  if (!prompt || typeof prompt !== "string") {
    return (
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/10 w-full max-w-full overflow-hidden">
        <p className="text-muted-foreground">Missing image prompt</p>
      </div>
    );
  }

  // Parse result safely with proper type guards
  let image: string | null = null;
  try {
    if (tool.result && typeof tool.result === "string") {
      const parsed = JSON.parse(tool.result);
      // Validate parsed object has image string field
      if (
        parsed &&
        typeof parsed === "object" &&
        "image" in parsed &&
        typeof parsed.image === "string"
      ) {
        image = parsed.image;
      }
    } else if (
      tool.result &&
      typeof tool.result === "object" &&
      "image" in tool.result
    ) {
      const imageValue = (tool.result as Record<string, unknown>).image;
      if (typeof imageValue === "string") {
        image = imageValue;
      }
    }
  } catch (error) {
    console.warn("Failed to parse image result:", error);
  }

  const isGenerating = state === "call" || state === "partial-call";
  const isGenerated = state === "result" && image;
  const hasError = state === "error";

  if (hasError) {
    return (
      <div className="space-y-3 p-4 border border-destructive/20 rounded-lg bg-destructive/5 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 text-destructive">
          <Icon name="close" className="h-4 w-4" />
          <span className="font-medium">Failed to generate image</span>
        </div>
        <ImagePrompt prompt={prompt} />
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/20 w-full max-w-full overflow-hidden">
        <GeneratingStatus />
        <ImagePrompt prompt={prompt} />
      </div>
    );
  }

  if (isGenerated) {
    return (
      <div className="space-y-3 w-full max-w-full overflow-hidden">
        <ImagePrompt prompt={prompt} />
        <div className="rounded-lg overflow-hidden border border-border">
          <img
            src={image || ""}
            alt={prompt}
            className="w-full max-h-[400px] object-cover"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/10 w-full max-w-full overflow-hidden">
      <p className="text-muted-foreground">No image generated</p>
      <ImagePrompt prompt={prompt} />
    </div>
  );
}

function CustomToolUI({
  tool,
  isLastMessage,
}: {
  tool: ToolInvocation;
  isLastMessage?: boolean;
}) {
  const { select } = useAgent();
  const result = (tool.result ?? {}) as Record<string, unknown>;

  if (tool.toolName === "HOSTING_APP_DEPLOY") {
    return <HostingAppDeploy tool={tool} />;
  }

  if (tool.toolName === "GENERATE_IMAGE") {
    return <GenerateImageToolUI tool={tool} />;
  }

  if (tool.state !== "result" || !tool.result) return null;

  switch (tool.toolName) {
    case "RENDER": {
      return (
        <Preview
          content={result.content as "url" | "html"}
          title={result.title as string}
        />
      );
    }

    case "CONFIGURE":
    case "AGENT_CREATE": {
      return (
        <div className="animate-in slide-in-from-bottom duration-300">
          <AgentCard
            id={result.id as string}
            name={result.name as string}
            description={result.description as string}
            avatar={result.avatar as string}
            displayLink={tool.toolName === "AGENT_CREATE"}
          />
        </div>
      );
    }
    case "SHOW_PICKER":
    case "CONFIRM": {
      const options = (result.options as ConfirmOption[]).map((option) => ({
        id: option.value,
        ...option,
      }));

      return (
        <Picker
          question={result.question as string}
          options={options}
          onSelect={(value) => select(tool.toolCallId, value)}
          disabled={!isLastMessage}
        />
      );
    }
    default: {
      return null;
    }
  }
}

export function ToolMessage({
  toolInvocations,
  isLastMessage,
}: ToolMessageProps) {
  // Separate tools into timeline tools and custom UI tools using memoization
  const { timelineTools, customUITools } = useMemo(() => {
    const timeline: ToolInvocation[] = [];
    const customUI: ToolInvocation[] = [];

    toolInvocations.forEach((tool: ToolInvocation) => {
      if (
        tool.toolName === "GENERATE_IMAGE" &&
        tool.args &&
        "prompt" in tool.args
      ) {
        customUI.push(tool);
      } else if (isCustomUITool(tool.toolName)) {
        customUI.push(tool);
      } else {
        timeline.push(tool);
      }
    });

    return { timelineTools: timeline, customUITools: customUI };
  }, [toolInvocations]);

  return (
    <div className="w-full space-y-4">
      {/* Timeline tools */}
      {timelineTools.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-2 w-full border border-border rounded-2xl",
            timelineTools.length > 1 && "p-2",
          )}
        >
          {timelineTools.map((tool, index) => (
            <ToolStatus
              key={tool.toolCallId}
              tool={tool}
              isLast={index === timelineTools.length - 1}
              isSingle={timelineTools.length === 1}
            />
          ))}
        </div>
      )}

      {/* Custom UI tools */}
      {customUITools.map((tool) => (
        <CustomToolUI
          key={tool.toolCallId}
          tool={tool}
          isLastMessage={isLastMessage}
        />
      ))}
    </div>
  );
}
