import { type Message, useChat } from "@ai-sdk/react";
import { Agent, API_SERVER_URL, getModel, useAgentRoot } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { trackEvent } from "../../hooks/analytics.ts";
import { PageLayout } from "../pageLayout.tsx";
import { ChatError } from "./ChatError.tsx";
import { ChatInput } from "./ChatInput.tsx";
import { Welcome } from "./EmptyState.tsx";
import { ChatHeader } from "./Header.tsx";
import { ChatMessage } from "./Message.tsx";
import { IMAGE_REGEXP, openPreviewPanel } from "./utils/preview.ts";

interface ChatProps {
  agent?: Agent;
  threadId?: string;
  initialMessages?: Message[];
  panels?: string[];
  view?: "readonly" | "interactive";
}

interface ChatMessagesProps {
  messages: Message[];
  status: "streaming" | "submitted" | "ready" | "idle" | "error";
  handlePickerSelect: (
    toolCallId: string,
    selectedValue: string,
  ) => Promise<void>;
  error?: Error;
  onRetry?: (context?: string[]) => void;
}

interface FileData {
  name: string;
  contentType: string;
  url: string;
}

function ChatMessages(
  { messages, status, handlePickerSelect, error, onRetry }: ChatMessagesProps,
) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className="animate-in slide-in-from-bottom duration-300"
        >
          <ChatMessage
            message={message}
            handlePickerSelect={handlePickerSelect}
          />
        </div>
      ))}
      {error && <ChatError error={error} onRetry={onRetry} />}
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

const setAutoScroll = (e: HTMLDivElement | null, enabled: boolean) => {
  if (!e) return;

  e.dataset.disableAutoScroll = enabled ? "false" : "true";
};

const isAutoScrollEnabled = (e: HTMLDivElement | null) => {
  return e?.dataset.disableAutoScroll !== "true";
};

export function Chat({
  agent,
  threadId,
  initialMessages = [],
  panels,
  view = "interactive",
}: ChatProps) {
  const agentRoot = useAgentRoot(agent?.id ?? "");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep track of the last file data for use in the next message
  const fileDataRef = useRef<FileData[]>([]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
    error,
    append,
    stop,
  } = useChat({
    initialMessages,
    credentials: "include",
    headers: {
      "x-deno-isolate-instance-id": agentRoot,
    },
    api: new URL("/actors/AIAgent/invoke/stream", API_SERVER_URL).href,
    experimental_prepareRequestBody: ({ messages }) => {
      const message = messages.at(-1);

      const files = fileDataRef.current;

      return {
        args: [[{
          ...message,
          annotations: files && files.length > 0
            ? [
              files.map((file: FileData) => ({
                type: "file",
                url: file.url,
                name: file.name,
                contentType: file.contentType,
                content:
                  "This message refers to a file uploaded by the user. You might use the file URL as a parameter to a tool call.",
              })),
            ]
            : message?.annotations || [],
        }], {
          model: getModel(),
        }],
        metadata: {
          threadId: threadId ?? agent?.id ?? "",
        },
      };
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "RENDER") {
        const { content, title } = toolCall.args as {
          content: string;
          title: string;
        };

        const isImageLike = content && IMAGE_REGEXP.test(content);

        if (!isImageLike) {
          openPreviewPanel(
            `preview-${toolCall.toolCallId}`,
            content,
            title,
          );
        }

        return {
          success: true,
        };
      }
    },
  });

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [initialMessages, scrollToBottom]);

  useLayoutEffect(() => {
    if (!isAutoScrollEnabled(scrollRef.current)) {
      return;
    }

    scrollToBottom();
  }, [messages, scrollToBottom]);

  useLayoutEffect(() => {
    let cancel = false;

    if (!scrollRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      if (cancel) return;

      const scroll = entries.some((e) => e.isIntersecting);

      setAutoScroll(scrollRef.current, scroll);
    }, { root: null, threshold: 0 });

    observer.observe(scrollRef.current);

    return () => {
      cancel = true;
      observer.disconnect();
    };
  }, [messages]);

  useEffect(() => {
    if (!agent) return;

    const searchParams = new URLSearchParams(globalThis.location.search);
    const messageParam = searchParams.get("message");

    if (messageParam && messages.length === initialMessages.length) {
      append({ role: "user", content: messageParam });

      const url = new URL(globalThis.location.href);
      url.search = "";
      globalThis.history.replaceState({}, "", url);
    }
  }, [agent, append, initialMessages.length, messages.length]);

  const handlePickerSelect = async (
    toolCallId: string,
    selectedValue: string,
  ) => {
    if (selectedValue) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => ({
          ...msg,
          toolInvocations: msg.toolInvocations?.filter(
            (tool) => tool.toolCallId !== toolCallId,
          ),
        }))
      );

      await append({ role: "user", content: selectedValue });
    }
  };

  const handleRetry = async (context?: string[]) => {
    const lastUserMessage = messages.findLast((msg) => msg.role === "user");
    if (!lastUserMessage) return;

    await append({
      content: lastUserMessage.content,
      role: "user",
      annotations: context || [],
    });

    trackEvent("chat_retry", {
      data: { agent, threadId, lastUserMessage: lastUserMessage.content },
    });
  };

  const handleChatSubmit = (
    e: React.FormEvent<HTMLFormElement>,
    options?: {
      experimental_attachments?: FileList;
      fileData?: FileData[];
      abort?: boolean;
    },
  ) => {
    if (options?.fileData && options.fileData.length > 0) {
      fileDataRef.current = options.fileData;
    } else {
      fileDataRef.current = [];
    }

    handleSubmit(e, options);

    setAutoScroll(scrollRef.current, true);

    // the timeout is absolutely necessary trust me do not question do not remove just accept it
    setTimeout(() => {
      fileDataRef.current = [];
    }, 1000);
  };

  if (view === "readonly") {
    return (
      <PageLayout
        header={null}
        main={
          <div className="w-full max-w-[800px] mx-auto">
            {messages.length === 0 ? <Welcome agent={agent} /> : (
              <ChatMessages
                messages={messages}
                status={status as
                  | "streaming"
                  | "submitted"
                  | "ready"
                  | "idle"}
                handlePickerSelect={handlePickerSelect}
                error={error}
              />
            )}
          </div>
        }
      />
    );
  }

  return (
    <PageLayout
      header={<ChatHeader agent={agent} panels={panels} />}
      footer={
        <div className="w-full max-w-[800px] mx-auto relative">
          <ChatInput
            agentRoot={agentRoot}
            input={input}
            disabled={!agent}
            isLoading={status === "submitted" || status === "streaming"}
            handleInputChange={handleInputChange}
            handleSubmit={handleChatSubmit}
            stop={stop}
          />
        </div>
      }
      main={
        <div className="w-full max-w-[800px] mx-auto">
          {messages.length === 0 ? <Welcome agent={agent} /> : (
            <ChatMessages
              messages={messages}
              status={status}
              handlePickerSelect={handlePickerSelect}
              error={error}
              onRetry={handleRetry}
            />
          )}

          <div className="h-16" ref={scrollRef}>
            <div
              className={cn(
                "absolute bottom-0 -translate-y-1/2 left-1/2 transform -translate-x-1/2",
                "w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center",
                "cursor-pointer hover:bg-slate-50 transition-colors z-50 border border-slate-200",
                `[[data-disable-auto-scroll="false"]_&]:opacity-0 opacity-100 transition-opacity delay-300`,
              )}
              onClick={() => scrollToBottom()}
              aria-label="Scroll to bottom"
            >
              <Icon name="arrow_downward" />
            </div>
          </div>
        </div>
      }
    />
  );
}
