import { type UIMessage } from "ai";
import { cn } from "@deco/ui/lib/utils.ts";
import { Metadata } from "@deco/ui/types/chat-metadata.ts";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import { MessageTextPart } from "./parts/text-part.tsx";

export interface MessageProps<T extends Metadata> {
  message: UIMessage<T>;
  status?: "streaming" | "submitted" | "ready" | "error";
  className?: string;
}

function useTimestamp(created_at: string | Date) {
  return new Date(created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageUser<T extends Metadata>({
  message,
  className,
}: MessageProps<T>) {
  const { id, parts, metadata: { user, created_at } = {} } = message;
  const formattedTimestamp = useTimestamp(
    created_at ?? new Date().toISOString(),
  );

  return (
    <div
      className={cn(
        "w-full min-w-0 group relative flex items-start gap-4 px-4 z-20 text-foreground flex-row-reverse py-4",
        className,
      )}
    >
      <Avatar
        url={user?.avatar}
        fallback={user?.name || "U"}
        shape="circle"
        size="sm"
        className="mt-0.5 shrink-0"
      />

      <div className="flex flex-col gap-2 min-w-0 items-end max-w-3/4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {user?.name || "You"}
          </span>
          <span>{formattedTimestamp}</span>
        </div>

        <div className="w-full min-w-0 not-only:rounded-2xl text-[0.9375rem] wrap-break-word overflow-wrap-anywhere bg-muted px-4 py-3">
          {parts.map((part, index) => {
            if (part.type === "text") {
              return (
                <MessageTextPart
                  key={`${id}-${index}`}
                  id={id}
                  text={part.text}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
