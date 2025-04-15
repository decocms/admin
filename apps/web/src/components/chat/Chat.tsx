import { type Message, useChat } from "@ai-sdk/react";
import {
  Agent,
  API_SERVER_URL,
  DEFAULT_REASONING_MODEL,
  useAgentRoot,
  useUpdateAgent,
} from "@deco/sdk";
import { useEffect, useLayoutEffect, useRef } from "react";
import { ChatInput } from "./ChatInput.tsx";
import { Welcome } from "./EmptyState.tsx";
import { ChatHeader } from "./Header.tsx";
import { ChatMessage } from "./Message.tsx";
import { openPreviewPanel } from "./utils/preview.ts";
import { PageLayout } from "../pageLayout.tsx";
import { trackEvent } from "../../hooks/analytics.ts";
import { ChatError } from "./ChatError.tsx";

interface ChatProps {
  agent?: Agent;
  threadId?: string;
  initialMessages?: Message[];
  panels?: string[];
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
}: ChatProps) {
  const agentRoot = useAgentRoot(agent?.id ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const updateAgent = useUpdateAgent();

  // Keep track of the last file data for use in the next message
  const fileDataRef = useRef<{
    name: string;
    contentType: string;
    url: string;
  }[]>([]);

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
              files.map((file) => ({
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

        openPreviewPanel(
          `preview-${toolCall.toolCallId}`,
          content,
          title,
        );
        return {
          success: true,
        };
      }
    },
  });

  useLayoutEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  // Auto-send message from query string on first load
  useEffect(() => {
    if (!agent) return;

    const searchParams = new URLSearchParams(globalThis.location.search);
    const messageParam = searchParams.get("message");

    if (messageParam && messages.length === initialMessages.length) {
      append({ role: "user", content: messageParam });

      // Clear the query string after appending the message
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
      // Remove the picker
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
      fileData?: {
        name: string;
        contentType: string;
        url: string;
      }[];
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

  return (
    <PageLayout
      header={<ChatHeader agent={agent} panels={panels} />}
      footer={
        <div className="w-full max-w-[800px] mx-auto">
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
      {/* Scrollable Messages */}
      <div className="w-full max-w-[800px] mx-auto overflow-y-auto px-4 py-2">
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
      </div>
    </PageLayout>
  );
}
