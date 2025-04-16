import { type Message } from "@ai-sdk/react";
import {
  Agent,
  API_SERVER_URL,
  DEFAULT_REASONING_MODEL,
  useAgentRoot,
  useUpdateAgent,
} from "@deco/sdk";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "./ChatInput.tsx";
import { Welcome } from "./EmptyState.tsx";
import { ChatHeader } from "./Header.tsx";
import { ChatMessage } from "./Message.tsx";
import { PageLayout } from "../pageLayout.tsx";
import { trackEvent } from "../../hooks/analytics.ts";
import { ChatError } from "./ChatError.tsx";
import { Icon } from "../../../../../packages/ui/src/components/icon.tsx";
import { IMAGE_REGEXP } from "./utils/preview.ts";
import { openPreviewPanel } from "./utils/preview.ts";
import { useChat } from "@ai-sdk/react";

interface ChatProps {
  agent?: Agent;
  threadId?: string;
  initialMessages?: Message[];
  panels?: string[];
  view?: "readonly" | "interactive";
}

interface ChatMessagesProps {
  messages: Message[];
  status: "streaming" | "submitted" | "ready" | "idle";
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

export function Chat({
  agent,
  threadId,
  initialMessages = [],
  panels,
  view = "interactive",
}: ChatProps) {
  const agentRoot = useAgentRoot(agent?.id ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const autoScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const updateAgent = useUpdateAgent();

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
        }]],
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

  useEffect(() => {
    const setupViewport = () => {
      const viewport = document.querySelector(
        '[data-slot="scroll-area-viewport"]',
      );
      if (viewport instanceof HTMLDivElement) {
        scrollViewportRef.current = viewport;
        return viewport;
      }
      return null;
    };

    const viewport = setupViewport();
    if (!viewport || messages.length === 0) return;

    const timer = setTimeout(() => {
      scrollToBottom("auto");
    }, 100);

    return () => clearTimeout(timer);
  }, [messages.length]);

  useEffect(() => {
    const scrollContainer = scrollViewportRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (autoScrollingRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 10;
      const scrollingUp = scrollTop < lastScrollTopRef.current;

      if (scrollingUp) {
        setUserScrolled(true);
      } else if (isBottom) {
        setUserScrolled(false);
      }

      setIsAtBottom(isBottom);
      lastScrollTopRef.current = scrollTop;
    };

    lastScrollTopRef.current = scrollContainer.scrollTop;
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [scrollViewportRef.current]);

  useEffect(() => {
    const scrollContainer = scrollViewportRef.current;
    if (!scrollContainer) return;

    const shouldAutoScroll = isAtBottom ||
      (status === "streaming" && !userScrolled);
    if (!shouldAutoScroll) return;

    const timer = setTimeout(() => {
      scrollToBottom("auto");
    }, 50);

    return () => clearTimeout(timer);
  }, [messages, isAtBottom, status, userScrolled]);

  useEffect(() => {
    const scrollContainer = scrollViewportRef.current;
    if (!scrollContainer || messages.length === 0) return;

    const initialScrollTimeout = setTimeout(() => {
      scrollToBottom("auto");
    }, 300);

    return () => clearTimeout(initialScrollTimeout);
  }, []);

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

  const handleModelChange = async (model: string) => {
    if (!agent || !agent.id) return;

    const updatedAgent = {
      ...agent,
      model,
    } as Agent;

    await updateAgent.mutateAsync(updatedAgent);
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

    // the timeout is absolutely necessary trust me do not question do not remove just accept it
    setTimeout(() => {
      fileDataRef.current = [];
    }, 1000);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const scrollContainer = scrollViewportRef.current;
    if (!scrollContainer) return;

    autoScrollingRef.current = true;

    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior, block: "end" });
    } else {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }

    setTimeout(() => {
      autoScrollingRef.current = false;
      setUserScrolled(false);
      setIsAtBottom(true);
    }, 100);
  };

  if (view === "readonly") {
    return (
      <PageLayout
        header={null}
      >
        <div className="w-full max-w-[800px] mx-auto">
          <div ref={containerRef}>
            {messages.length === 0 ? <Welcome agent={agent} /> : (
              <ChatMessages
                messages={messages}
                status={status as "streaming" | "submitted" | "ready" | "idle"}
                handlePickerSelect={handlePickerSelect}
                error={error}
              />
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      header={<ChatHeader agent={agent} panels={panels} />}
      footer={
        <div className="w-full max-w-[800px] mx-auto relative">
          {!isAtBottom && (
            <div
              className="absolute bottom-[calc(100%+10px)] left-1/2 transform -translate-x-1/2 
                        w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center
                        cursor-pointer hover:bg-slate-50 transition-colors z-50 border border-slate-200"
              onClick={() => scrollToBottom()}
              aria-label="Scroll to bottom"
            >
              <Icon name="arrow_downward" />
            </div>
          )}
          <ChatInput
            agentRoot={agentRoot}
            input={input}
            disabled={!agent}
            isLoading={status === "submitted" || status === "streaming"}
            handleInputChange={handleInputChange}
            handleSubmit={handleChatSubmit}
            stop={stop}
            model={agent?.model ?? DEFAULT_REASONING_MODEL}
            onModelChange={handleModelChange}
          />
        </div>
      }
    >
      <div className="w-full max-w-[800px] mx-auto">
        <div ref={containerRef}>
          {messages.length === 0 ? <Welcome agent={agent} /> : (
            <ChatMessages
              messages={messages}
              status={status as "streaming" | "submitted" | "ready" | "idle"}
              handlePickerSelect={handlePickerSelect}
              error={error}
              onRetry={handleRetry}
            />
          )}
        </div>
        <div className="h-4" />
      </div>
    </PageLayout>
  );
}
