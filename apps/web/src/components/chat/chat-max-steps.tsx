import { DEFAULT_MAX_STEPS, useAgent } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useMemo } from "react";
import { useChatContext } from "./context.tsx";

export function ChatMaxSteps() {
  const { chat: { messages } } = useChatContext();

  /** go up on the messages and count the number of tool calls. If the number of tool calls is greater than max_steps, true */
  const { toolCalls, llmCalls } = useMemo(() => {
    let toolCalls = 0;
    let llmCalls = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "assistant") {
        break;
      }
      llmCalls += 1;
      toolCalls += messages[i].toolInvocations?.length ?? 1;
    }
    return { toolCalls, llmCalls };
  }, [messages]);

  // Will be handled by ToolMessage component
  // This makes the MaxSteps UI display clustered with the other tool calls
  if (llmCalls === 1) {
    return null;
  }

  return (
    <div className="w-full border border-border rounded-2xl p-2 mb-4 empty:hidden">
      <ChatMaxSteps.UI llmCalls={toolCalls} />
    </div>
  );
}

ChatMaxSteps.UI = ({ llmCalls }: { llmCalls: number }) => {
  const { agentId, chat: { append, status } } = useChatContext();
  const { data: { max_steps = DEFAULT_MAX_STEPS } } = useAgent(agentId);
  const hasReachedMaxSteps = llmCalls >= max_steps;

  if (!hasReachedMaxSteps || status !== "ready") {
    return null;
  }

  return (
    <div
      className="p-2 grid gap-2"
      style={{ gridTemplateColumns: "auto 1fr auto" }}
    >
      <div className="w-5 h-5">
        <Icon name="error" filled className="text-destructive" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium text-foreground">
          Agent hit the step limit for this response
        </div>
        <div className="text-xs text-muted-foreground">
          You can let the agent keep going from where it stopped, or adjust the
          step limit in settings.
        </div>
      </div>

      <Button
        variant="secondary"
        onClick={() => {
          append({ role: "user", content: "Continue" });
        }}
      >
        Continue from here
      </Button>
    </div>
  );
};
