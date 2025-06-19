import { DEFAULT_MAX_STEPS, useAgent } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useMemo } from "react";
import { useChatContext } from "./context.tsx";

export function ChatMaxSteps() {
  const { agentId, chat: { append, status, messages } } = useChatContext();
  const { data: { max_steps = DEFAULT_MAX_STEPS } } = useAgent(agentId);

  /**
   * Reverse search for the number of llm calls in the last agent run
   */
  const toolCalls = useMemo(() => {
    let toolCalls = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "assistant") {
        break;
      }

      toolCalls += messages[i].toolInvocations?.length ?? 1;
    }
    return toolCalls;
  }, [messages]);

  const hasReachedMaxSteps = toolCalls >= max_steps;

  if (!hasReachedMaxSteps || status !== "ready") {
    return null;
  }

  return (
    <div className="w-full border border-border rounded-2xl mb-4 empty:hidden">
      <div
        className="p-4 grid gap-2"
        style={{ gridTemplateColumns: "auto 1fr auto" }}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          <Icon name="error" filled className="text-destructive" size={20} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-sm font-medium text-foreground">
            Agent hit the step limit for this response
          </div>
          <div className="text-xs text-muted-foreground">
            You can let the agent keep going from where it stopped, or adjust
            the step limit in settings.
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
    </div>
  );
}
