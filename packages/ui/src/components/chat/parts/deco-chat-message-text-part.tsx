import { useCallback } from "react";
import { useCopy } from "../../../hooks/use-copy.ts";
import { Button } from "../../button.tsx";
import { MemoizedMarkdown } from "../chat-markdown.tsx";
import { Icon } from "../../icon.tsx";

interface DecoChatMessageTextPartProps {
  id: string;
  text: string;
  copyable?: boolean;
}

export function DecoChatMessageTextPart({
  id,
  text,
  copyable = false,
}: DecoChatMessageTextPartProps) {
  const { handleCopy } = useCopy();

  const handleCopyMessage = useCallback(async () => {
    await handleCopy(text);
  }, [text, handleCopy]);

  return (
    <div className="group/part relative">
      <MemoizedMarkdown id={id} text={text} />
      {copyable && (
        <div className="mt-2 flex w-full min-h-[28px] items-center justify-end gap-2 text-xs text-muted-foreground opacity-0 pointer-events-none transition-all duration-200 group-hover/part:opacity-100 group-hover/part:pointer-events-auto">
          <div className="flex gap-1">
            <Button
              onClick={handleCopyMessage}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground px-2 py-1 h-auto whitespace-nowrap"
            >
              <Icon name="content_copy" className="mr-1 text-sm" />
              Copy message
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
