import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@deco/ui/components/sheet.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { MCPConnection } from "@/storage/types";
import { KEYS } from "@/web/lib/query-keys";

interface DecoChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  organizationName: string;
  connection: MCPConnection;
}

interface ModelInfo {
  id: string;
  model: string;
  name: string;
  logo?: string | null;
  description?: string | null;
  capabilities?: string[];
}

interface ModelsResponse {
  models: ModelInfo[];
}

type ChatMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: number;
};

const SYSTEM_PROMPT = `
You are deco chat, the official assistant for decocms.com's MCP Mesh admin.

Your job:
- Help teams understand and configure MCP connections, bindings, and model providers
- Explain how the MODELS binding works and how to debug common issues
- Suggest next steps when a connection fails validation
- Provide actionable guidance for building model-backed features with MCP Mesh

Guidelines:
- Keep answers concise but detailed enough to unblock the user
- When describing steps, number them in order
- When referencing UI, mention the exact labels so the user can find them quickly
- If you don't know something definitively, say so and suggest how to verify it
`.trim();

export function DecoChatSheet({
  open,
  onOpenChange,
  orgSlug,
  organizationName,
  connection,
}: DecoChatSheetProps) {
  const modelsQuery = useQuery({
    queryKey: KEYS.modelsList(orgSlug),
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await fetch(`/api/${orgSlug}/models/list`, {
        credentials: "include",
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          detail || "Failed to fetch models for the configured provider.",
        );
      }

      return (await response.json()) as ModelsResponse;
    },
  });

  const models = modelsQuery.data?.models ?? [];

  const chat = useDecoChat({
    orgSlug,
    models,
  });

  const {
    messages,
    input,
    setInput,
    sendMessage,
    isStreaming,
    stop,
    error,
    clearConversation,
    selectedModelId,
    setSelectedModelId,
  } = chat;

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const isEmpty = messages.length === 0;

  const handleSubmit = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();
      void sendMessage();
    },
    [sendMessage],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-lg w-full p-0 gap-0 flex h-full flex-col"
        aria-description="Deco chat assistant"
      >
        <SheetHeader className="px-5 pb-4 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-lime-300 text-lime-950 shadow-inner">
                <Icon name="robot_2" size={20} />
              </span>
              <div className="text-left">
                <SheetTitle className="text-base font-semibold">
                  deco chat
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Powered by {connection.name}
                </SheetDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="secondary" className="text-xs font-normal">
                {organizationName}
              </Badge>
              <Select
                value={selectedModelId ?? undefined}
                onValueChange={setSelectedModelId}
                disabled={modelsQuery.isLoading || models.length === 0}
              >
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.model}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 min-h-0 flex-col gap-4">
          <div className="px-5 text-xs text-muted-foreground">
            {modelsQuery.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
                Loading models...
              </div>
            )}
            {modelsQuery.error && (
              <div className="text-destructive">
                {(modelsQuery.error as Error).message}
              </div>
            )}
            {!modelsQuery.isLoading && models.length === 0 && (
              <div>
                The configured Models Provider isn&rsquo;t returning any models.
                Review it under Settings &rarr; Models Provider; no extra setup
                is required inside this chat.
              </div>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5">
            <div className="flex flex-col gap-4 pr-4">
              {isEmpty ? (
                <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  Ask anything about configuring model providers or using MCP
                  Mesh. The assistant uses the Models Provider configured in
                  Settings for this organization.
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isStreaming={isStreaming}
                  />
                ))
              )}
            </div>
          </div>

          <div className="border-t border-border/80 px-5 py-4">
            <form className="space-y-3" onSubmit={handleSubmit}>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Textarea
                  value={input}
                  placeholder={
                    models.length === 0
                      ? "Configure a Models Provider in Settings to start chatting"
                      : "Ask deco chat for help..."
                  }
                  disabled={
                    models.length === 0 || isStreaming || !selectedModelId
                  }
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      !input.trim() ||
                      isStreaming ||
                      !selectedModelId ||
                      models.length === 0
                    }
                  >
                    Send
                  </Button>
                  {isStreaming && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={stop}
                    >
                      Stop generating
                    </Button>
                  )}
                  {!isEmpty && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearConversation}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Clear conversation
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.content ? (
          message.content
        ) : !isUser && isStreaming ? (
          <TypingIndicator />
        ) : (
          <span className="text-muted-foreground">Thinking...</span>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground/80 animate-bounce [animation-delay:-0.2s]" />
      <span className="size-2 rounded-full bg-muted-foreground/80 animate-bounce [animation-delay:-0.05s]" />
      <span className="size-2 rounded-full bg-muted-foreground/80 animate-bounce" />
    </span>
  );
}

function useDecoChat({
  orgSlug,
  models,
}: {
  orgSlug: string;
  models: ModelInfo[];
}) {
  const [messages, setMessages, resetMessages] = usePersistentMessages(orgSlug);
  const [input, setInput] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const firstModel = models[0];
    if (!firstModel) {
      setSelectedModelId(undefined);
      return;
    }

    if (!selectedModelId) {
      setSelectedModelId(firstModel.model);
      return;
    }

    const exists = models.some((model) => model.model === selectedModelId);
    if (!exists) {
      setSelectedModelId(firstModel.model);
    }
  }, [models, selectedModelId]);

  const updateAssistant = useCallback(
    (id: string, updater: (prev: string) => string) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id
            ? { ...message, content: updater(message.content) }
            : message,
        ),
      );
    },
    [setMessages],
  );

  const sendMessage = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || !selectedModelId) {
      if (!prompt) {
        console.warn("[deco-chat] Skipping send: empty prompt");
      } else if (!selectedModelId) {
        console.warn("[deco-chat] Skipping send: no selected model", {
          modelsCount: models.length,
        });
      }
      return;
    }

    setInput("");
    setError(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      createdAt: Date.now(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    const history = [...messagesRef.current, userMessage];
    messagesRef.current = [...history, assistantMessage];

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    try {
      await streamCompletion({
        orgSlug,
        model: selectedModelId,
        history,
        assistantId: assistantMessage.id,
        signal: controller.signal,
        updateAssistant,
      });
    } catch (streamError) {
      if ((streamError as Error).name === "AbortError") {
        return;
      }
      setError(
        streamError instanceof Error
          ? streamError.message
          : "Failed to get a response from the provider.",
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [input, orgSlug, selectedModelId, setMessages, updateAssistant]);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearConversation = useCallback(() => {
    messagesRef.current = [];
    resetMessages();
    setError(null);
  }, [resetMessages]);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isStreaming,
    stop,
    error,
    clearConversation,
    selectedModelId,
    setSelectedModelId,
  };
}

function usePersistentMessages(orgSlug: string) {
  const storageKey = useMemo(
    () => `mesh:decochat:messages:${orgSlug}`,
    [orgSlug],
  );
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        setMessagesState(JSON.parse(stored) as ChatMessage[]);
      } catch {
        setMessagesState([]);
      }
    } else {
      setMessagesState([]);
    }
    setHasHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey, hasHydrated]);

  const setMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setMessagesState((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
    },
    [],
  );

  const resetMessages = useCallback(() => {
    setMessagesState([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return [messages, setMessages, resetMessages] as const;
}

async function streamCompletion({
  orgSlug,
  model,
  history,
  assistantId,
  signal,
  updateAssistant,
}: {
  orgSlug: string;
  model: string;
  history: ChatMessage[];
  assistantId: string;
  signal: AbortSignal;
  updateAssistant: (id: string, updater: (prev: string) => string) => void;
}) {
  const response = await fetch(`/api/${orgSlug}/models/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPayload(history, model)),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Streaming request failed.");
  }

  if (!response.body) {
    const text = await response.text();
    updateAssistant(assistantId, () => text);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSSEChunk(chunk);
      if (parsed === "DONE") {
        boundary = buffer.indexOf("\n\n");
        continue;
      }
      if (parsed) {
        updateAssistant(assistantId, (prev) => prev + parsed);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim().length > 0) {
    const parsed = parseSSEChunk(buffer);
    if (parsed && parsed !== "DONE") {
      updateAssistant(assistantId, (prev) => prev + parsed);
    }
  }
}

function buildPayload(history: ChatMessage[], model: string) {
  return {
    model,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
  };
}

function parseSSEChunk(chunk: string): string | "DONE" | null {
  const trimmed = chunk.trim();
  if (!trimmed) return null;

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const dataLine = lines.find((line) => line.startsWith("data:")) ?? trimmed;

  const payload = dataLine.startsWith("data:")
    ? dataLine.slice(5).trim()
    : dataLine;

  if (!payload) {
    return null;
  }

  if (payload === "[DONE]") {
    return "DONE";
  }

  return extractTextFromPayload(payload);
}

function extractTextFromPayload(payload: string): string | null {
  try {
    const json = JSON.parse(payload);

    const choice = json.choices?.[0];
    if (choice) {
      const delta = choice.delta ?? choice.message;
      if (delta?.content) {
        if (typeof delta.content === "string") {
          return delta.content;
        }
        if (Array.isArray(delta.content)) {
          return delta.content
            .map((part: { text?: string } | string) =>
              typeof part === "string" ? part : (part.text ?? ""),
            )
            .join("");
        }
      }
      if (typeof delta?.text === "string") {
        return delta.text;
      }
    }

    if (Array.isArray(json.output_text)) {
      return json.output_text.join("");
    }

    if (typeof json.output_text === "string") {
      return json.output_text;
    }

    if (json.delta?.output_text) {
      if (Array.isArray(json.delta.output_text)) {
        return json.delta.output_text.join("");
      }
      if (typeof json.delta.output_text === "string") {
        return json.delta.output_text;
      }
    }

    if (json.delta?.text) {
      return json.delta.text;
    }

    if (json.event === "completion" && Array.isArray(json.data?.output_text)) {
      return json.data.output_text.join("");
    }

    const contentFromArray = extractTextFromContentArray(
      json.delta?.content ?? json.content,
    );
    if (contentFromArray) return contentFromArray;

    if (typeof json.content === "string") {
      return json.content;
    }
  } catch {
    return payload;
  }

  return null;
}

function extractTextFromContentArray(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const text = content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
      return "";
    })
    .join("");
  return text.length > 0 ? text : null;
}
