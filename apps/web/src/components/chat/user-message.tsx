import type { UIMessage } from "@ai-sdk/react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { FileUIPart, ToolUIPart } from "ai";
import { memo, useEffect, useMemo, useState } from "react";
import { MemoizedMarkdown } from "./chat-markdown.tsx";
import { ReasoningPart } from "./reasoning-part.tsx";
import { ToolMessage } from "./tool-message.tsx";
import { useCopy } from "../../hooks/use-copy.ts";

interface UserMessageProps {
  message: UIMessage;
  onScrollToMessage?: () => void;
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

export const UserMessage = memo(function UserMessage({
  message,
  onScrollToMessage,
}: UserMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const textContent = useMemo(() => {
    if (message.parts) {
      return message.parts
        .filter((part) => part.type === "text" && "text" in part)
        .map((part) =>
          part.type === "text" && "text" in part ? part.text : "",
        )
        .join("\n");
    }
    return "content" in message && typeof message.content === "string"
      ? message.content
      : "";
  }, [message.parts, message]);

  const isLongMessage = useMemo(() => {
    return textContent.length > 100;
  }, [textContent]);

  return (
    <div className="w-full group relative">
      <div className="flex flex-col gap-2 min-w-0 items-end ml-auto">
        <div
          onClick={onScrollToMessage}
          className="w-full border min-w-0 shadow-[0_3px_6px_-1px_rgba(0,0,0,0.1)] rounded-lg text-[0.9375rem] break-words overflow-wrap-anywhere bg-muted px-4 pt-2 pb-1 cursor-pointer hover:bg-muted/80 transition-colors"
        >
          <div
            className={cn(
              isLongMessage && !isExpanded && "overflow-hidden relative",
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
            {isLongMessage && !isExpanded && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted to-transparent pointer-events-none" />
            )}
          </div>

          {isLongMessage && (
            <div className="flex justify-center">
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                variant="ghost"
                size="xs"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Icon
                  name={isExpanded ? "expand_less" : "expand_more"}
                  className="text-sm"
                />
              </Button>
            </div>
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
                    "text-xs whitespace-pre-wrap break-words overflow-auto",
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
