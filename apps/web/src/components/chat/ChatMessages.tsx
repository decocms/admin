import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useLayoutEffect, useRef } from "react";
import { trackEvent } from "../../hooks/analytics.ts";
import { ChatContainer } from "./Container.tsx";
import { useChatContext } from "./context.tsx";
import { Welcome } from "./EmptyState.tsx";
import { ChatMessage } from "./Message.tsx";

function ChatMessagesUI() {
  const {
    agentId,
    threadId,
    messages,
    status,
    error,
    append,
  } = useChatContext();

  const handleRetry = async (context?: string[]) => {
    const lastUserMessage = messages.findLast((msg) => msg.role === "user");
    if (!lastUserMessage) return;

    await append({
      content: lastUserMessage.content,
      role: "user",
      annotations: context || [],
    });

    trackEvent("chat_retry", {
      data: { agentId, threadId, lastUserMessage: lastUserMessage.content },
    });
  };

  if (messages.length === 0) {
    return <Welcome agentId={agentId} />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="w-full animate-in slide-in-from-bottom duration-300">
        <p className="w-fit rounded-2xl text-xs bg-slate-50 p-3 text-slate-700 text-center mx-auto">
          For now, only your last 3 messages are used to generate{" "}
          <br />a response. Expanded memory is coming soon.
        </p>
      </div>
      {messages.map((message) => (
        <div
          key={message.id}
          className="animate-in slide-in-from-bottom duration-300"
        >
          <ChatMessage message={message} />
        </div>
      ))}
      {error && (
        <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 ml-3">
          <div className="flex items-center gap-4 p-4 bg-destructive/5 text-destructive rounded-xl text-sm">
            <Icon name="info" />
            <p>An error occurred while generating the response.</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="bg-background hover:bg-background/80 shadow-none border border-input py-3 px-4 h-10"
                onClick={() => {
                  handleRetry([
                    JSON.stringify({
                      type: "error",
                      message: error.message,
                      name: error.name,
                      stack: error.stack,
                    }),
                    "The previous attempt resulted in an error. I'll try to address the error and provide a better response.",
                  ]);
                }}
              >
                <Icon name="refresh" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}
      {(status === "streaming" || status === "submitted") && (
        <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 text-muted-foreground ml-4">
          <span className="inline-flex items-center gap-1">
            <span className="animate-bounce [animation-delay:-0.3s]">.</span>
            <span className="animate-bounce [animation-delay:-0.2s]">.</span>
            <span className="animate-bounce [animation-delay:-0.1s]">.</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function ChatMessages() {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  return (
    <ChatContainer>
      <div ref={containerRef}>
        <ChatMessagesUI />
      </div>
    </ChatContainer>
  );
}
