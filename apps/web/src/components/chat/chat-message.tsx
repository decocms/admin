import type { UIMessage } from "@ai-sdk/react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { FileUIPart, ToolUIPart } from "ai";
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MemoizedMarkdown } from "./chat-markdown.tsx";
import { ReasoningPart } from "./reasoning-part.tsx";
import { ToolMessage } from "./tool-message.tsx";
import { useCopy } from "../../hooks/use-copy.ts";
import { getAgentAvatar, getAgentName } from "../../utils/agent-avatars.ts";
import { useUser } from "../../hooks/use-user.ts";
import { useAgenticChat } from "./provider.tsx";

interface ChatMessageProps {
  message: UIMessage;
  isLastMessage?: boolean;
  centered?: boolean;
}

interface MessageAttachment {
  contentType?: string;
  url: string;
  name?: string;
}

interface ImagePart {
  type: "image";
  image: string;
}

interface ReasoningPart {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
}

const isToolPart = (part: UIMessage["parts"][number]): part is ToolUIPart => {
  return part.type.startsWith("tool-") && "toolCallId" in part;
};

export const ChatMessage = memo(function ChatMessage({
  message,
  centered = false,
}: ChatMessageProps) {
  const { handleCopy: copyContent } = useCopy();
  const isUser = message.role === "user";
  const createdAt = useMemo(() => {
    const metadataCreatedAt = (message.metadata as { createdAt?: string })
      ?.createdAt;
    if (metadataCreatedAt) {
      return metadataCreatedAt;
    }
    // If no createdAt in metadata, don't show timestamp (return null)
    // This prevents Date.now() from being called on every render
    return null;
  }, [message.metadata]);

  const timestamp = useMemo(() => {
    if (!createdAt) return null;
    const date = new Date(createdAt);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, [createdAt]);

  const attachments = useMemo(
    () =>
      message.parts
        ?.filter((part) => part.type === "file")
        .filter((part) => !part.mediaType?.startsWith("image/"))
        .map((part) => ({
          contentType: part.mediaType,
          url: part.url,
          name: part.filename,
        })) as MessageAttachment[] | undefined,
    [message.parts],
  );

  const handleCopy = useCallback(async () => {
    const content = message.parts
      ? message.parts
          .filter((part) => part.type === "text" && "text" in part)
          .map((part) =>
            part.type === "text" && "text" in part ? part.text : "",
          )
          .join("\n")
      : "content" in message && typeof message.content === "string"
        ? message.content
        : "";
    await copyContent(content);
  }, [message.parts, message, copyContent]);

  const hasTextContent = useMemo(() => {
    return (
      message.parts?.some((part) => part.type === "text") ||
      ("content" in message && typeof message.content === "string")
    );
  }, [message.parts, message]);

  // Get agent info for assistant messages from message metadata
  // The agentId is set in the stream response metadata, so it should always be available
  const agentId = useMemo(() => {
    if (!isUser && message.metadata) {
      return (message.metadata as { agentId?: string })?.agentId;
    }
    return undefined;
  }, [isUser, message.metadata]);

  // Get agent from context (works for both well-known and custom agents)
  const { agent: contextAgent } = useAgenticChat();

  // Get user info for user messages from message metadata
  const userId = useMemo(() => {
    if (isUser && message.metadata) {
      return (message.metadata as { userId?: string })?.userId;
    }
    return undefined;
  }, [isUser, message.metadata]);

  // Prioritize agentId from message metadata to get avatar
  // This ensures we show the avatar that was used when the message was sent
  const agentAvatar = useMemo(() => {
    // If message has agentId in metadata, use that to determine avatar
    if (agentId) {
      // If the message's agentId matches the current context agent, use context agent's avatar
      // (which might have been updated, but preserves the original if context changed)
      if (contextAgent?.id === agentId && contextAgent?.avatar) {
        return contextAgent.avatar;
      }
      // Otherwise, use getAgentAvatar for well-known agents
      return getAgentAvatar(agentId);
    }
    // Fallback to context agent avatar if no agentId in message metadata
    return contextAgent?.avatar || getAgentAvatar(undefined);
  }, [agentId, contextAgent?.id, contextAgent?.avatar]);

  const agentName = useMemo(() => {
    // If message has agentId in metadata, use that to determine name
    if (agentId) {
      // If the message's agentId matches the current context agent, use context agent's name
      if (contextAgent?.id === agentId && contextAgent?.name) {
        return contextAgent.name;
      }
      // Otherwise, use getAgentName for well-known agents
      return getAgentName(agentId);
    }
    // Fallback to context agent name if no agentId in message metadata
    return contextAgent?.name || getAgentName(undefined);
  }, [agentId, contextAgent?.id, contextAgent?.name]);

  // Get user avatar and name for user messages
  const user = useUser();
  const isCurrentUser = userId && user && userId === user.id;
  const userAvatarUrl = useMemo(() => {
    // For user messages, always use current user's avatar if available
    if (isUser && user) {
      return user.metadata.avatar_url;
    }
    if (!userId) return undefined;
    if (isCurrentUser) {
      return user.metadata.avatar_url;
    }
    // For other users, we'd need to fetch from team members
    // For now, just return undefined and let UserInfo handle it
    return undefined;
  }, [isUser, userId, isCurrentUser, user]);
  const userName = useMemo(() => {
    // For user messages, always use current user's name if available
    if (isUser && user) {
      return user.metadata.full_name || user.email;
    }
    if (!userId) return undefined;
    if (isCurrentUser) {
      return user.metadata.full_name || user.email;
    }
    return undefined;
  }, [isUser, userId, isCurrentUser, user]);

  return (
    <div
      className={cn(
        "w-full min-w-0 group relative flex gap-2 px-4 py-1 z-20 text-foreground",
        centered
          ? isUser
            ? "flex-row-reverse items-start"
            : "flex-row items-start"
          : "flex-col",
        !centered && (isUser ? "items-end" : "items-start"),
      )}
    >
      {/* Avatar */}
      <div className={cn("flex-shrink-0", !centered && "order-first")}>
        {!isUser ? (
          <div className="relative">
            <img
              src={agentAvatar}
              alt={agentName}
              className={cn(
                "rounded-[3.571px] object-cover border border-border",
                centered ? "size-7" : "size-5",
              )}
              onError={(e) => {
                // Fallback to a default icon if image fails to load
                const target = e.currentTarget;
                target.style.display = "none";
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) {
                  fallback.style.display = "flex";
                }
              }}
            />
            <div
              className={cn(
                "rounded-[3.571px] bg-muted border border-border items-center justify-center hidden",
                centered ? "size-7" : "size-5",
              )}
              style={{ display: "none" }}
            >
              <Icon
                name="smart_toy"
                size={centered ? 16 : 12}
                className="text-muted-foreground"
              />
            </div>
          </div>
        ) : (
          <Suspense
            fallback={
              <div
                className={cn(
                  "rounded-full bg-muted",
                  centered ? "size-7" : "size-5",
                )}
              />
            }
          >
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt={userName || "User"}
                className={cn(
                  "rounded-full object-cover border border-border",
                  centered ? "size-7" : "size-5",
                )}
              />
            ) : (
              <div
                className={cn(
                  "rounded-full bg-muted border border-border flex items-center justify-center",
                  centered ? "size-7" : "size-5",
                )}
              >
                <span
                  className={cn(
                    "text-muted-foreground",
                    centered ? "text-xs" : "text-[10px]",
                  )}
                >
                  {userName?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            )}
          </Suspense>
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "flex flex-col gap-2 min-w-0",
          centered
            ? isUser
              ? "items-end max-w-[75%]"
              : "items-start flex-1"
            : isUser
              ? "items-end max-w-[75%]"
              : "w-full items-start",
        )}
      >
        <div
          className={cn(
            "min-w-0 not-only:rounded-2xl text-[0.9375rem]",
            isUser
              ? "bg-muted px-4 py-3 rounded-bl-[16px] rounded-br-[16px] rounded-tl-[16px]"
              : "bg-transparent",
            "w-full",
          )}
        >
          {message.parts ? (
            <div className="space-y-3 w-full">
              {message.parts.map((part, index) => {
                if (part.type === "reasoning") {
                  return (
                    <ReasoningPart
                      key={index}
                      part={part}
                      messageId={message.id}
                      index={index}
                    />
                  );
                } else if (part.type === "text") {
                  return (
                    <MemoizedMarkdown
                      key={index}
                      part={part}
                      messageId={message.id}
                    />
                  );
                } else if (
                  part.type === "file" &&
                  "mediaType" in part &&
                  part.mediaType?.startsWith("image/")
                ) {
                  // Handle image files
                  return <ImagePart part={part} key={index} />;
                } else if (part.type === "step-start") {
                  // Step start parts are typically not rendered visually
                  return null;
                } else if (isToolPart(part)) {
                  // Handle individual tool parts
                  return <ToolMessage key={index} part={part} />;
                }
                return null;
              })}
            </div>
          ) : (
            <MemoizedMarkdown
              messageId={message.id}
              part={{
                type: "text",
                text:
                  "content" in message && typeof message.content === "string"
                    ? message.content || ""
                    : "",
              }}
            />
          )}

          {attachments && attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map(
                (attachment: MessageAttachment, index: number) => (
                  <AttachmentCard
                    key={`${message.id}-${index}`}
                    attachment={attachment}
                  />
                ),
              )}
            </div>
          )}
        </div>

        {/* Copy button and timestamp */}
        {(hasTextContent || (attachments && attachments.length > 0)) && (
          <div
            className={cn(
              "flex items-center gap-1",
              isUser ? "flex-row-reverse" : "flex-row",
            )}
          >
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
            >
              <Icon name="content_copy" size={14} />
            </Button>
            {timestamp && (
              <span className="text-xs text-muted-foreground whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {timestamp}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

function ImagePart({ part }: { part: FileUIPart }) {
  return (
    <a
      href={part.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative group flex items-center gap-2 rounded-xl"
    >
      <div className="relative">
        <img
          src={part.url}
          alt={part.filename || "Uploaded image"}
          className="rounded-lg max-h-[300px] object-cover"
        />
      </div>
    </a>
  );
}

function AttachmentCard({ attachment }: { attachment: MessageAttachment }) {
  const contentType =
    attachment.contentType ||
    (attachment.url.startsWith("data:")
      ? attachment.url.split(":")[1]?.split(";")[0]
      : undefined) ||
    "application/octet-stream";
  const isImage = contentType.startsWith("image/");
  const isPDF = contentType.startsWith("application/pdf");
  const isText =
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    contentType.endsWith("+json") ||
    contentType.endsWith("+xml") ||
    contentType === "application/xml";

  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative group flex items-center gap-2 p-2 bg-muted rounded-lg border border-border hover:bg-muted/50 transition-colors"
      >
        <div className="relative">
          <img
            src={attachment.url}
            alt={attachment.name ?? `attachment`}
            className="rounded-lg max-h-[300px] object-cover"
          />
        </div>
      </a>
    );
  }

  if (isPDF) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative group flex items-center gap-2 p-2 bg-muted rounded-lg border border-border hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
            <Icon name="picture_as_pdf" className="text-muted-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-foreground font-medium truncate max-w-[220px]">
              {attachment.name ?? "PDF Document"}
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">
              {contentType}
            </span>
          </div>
        </div>
      </a>
    );
  }

  if (isText) {
    return (
      <TextPreviewCard attachment={attachment} contentType={contentType} />
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative group flex items-center gap-2 p-2 bg-muted rounded-lg border border-border hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
          <Icon name="attach_file" className="text-muted-foreground" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-foreground font-medium truncate max-w-[220px]">
            {attachment.name ?? "Document"}
          </span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">
            {contentType}
          </span>
        </div>
      </div>
    </a>
  );
}

function TextPreviewCard({
  attachment,
  contentType,
}: {
  attachment: MessageAttachment;
  contentType: string;
}) {
  const { handleCopy, copied } = useCopy();
  const [text, setText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!expanded || text !== null) {
      return () => {
        cancelled = true;
      };
    }
    fetch(attachment.url)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch(() => {
        if (!cancelled) setText(null);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.url, expanded, text]);

  return (
    <div className="relative group p-2 bg-muted rounded-lg border border-border hover:bg-muted/50 transition-colors w-full max-w-[480px]">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted flex-shrink-0">
          <Icon name="description" className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-foreground font-medium truncate max-w-[260px]">
                {attachment.name ?? "Text file"}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                {contentType}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  if (text) {
                    handleCopy(text);
                  }
                }}
                title={copied ? "Copied" : "Copy content"}
              >
                <Icon name={copied ? "check" : "content_copy"} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? "Hide content" : "Show content"}
              >
                <Icon name={expanded ? "expand_less" : "expand_more"} />
              </Button>
            </div>
          </div>
          {expanded && (
            <div
              className={cn(
                "mt-2 rounded-md border border-border bg-background p-2",
                !text && "text-muted-foreground",
              )}
            >
              {text ? (
                <pre
                  className={cn(
                    "text-xs whitespace-pre-wrap overflow-auto",
                    "max-h-[500px]",
                  )}
                >
                  {text}
                </pre>
              ) : (
                <span className="text-xs">Loading preview…</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
