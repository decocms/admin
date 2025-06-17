import { unescapeHTML, weakEscapeHTML } from "@deco/sdk/utils";
import { Label } from "@deco/ui/components/label.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import { useState } from "react";
import RichTextArea from "./markdown.tsx";
import RawTextArea from "./raw.tsx";

export interface PromptInputProps {
  value: string;
  onChange: (markdown: string) => void;
  onKeyDown?: (
    event: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  onKeyUp?: (
    event: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  onPaste?: (
    event: React.ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  enableMentions?: boolean;
}

export default function PromptInput({
  value,
  onChange,
  onKeyDown,
  onKeyUp,
  onPaste,
  disabled,
  placeholder,
  className,
  enableMentions = false,
}: PromptInputProps) {
  const [view, setView] = useState<"raw" | "markdown">("raw");

  return (
    <div>
      <div className="flex justify-between items-center gap-2 mb-3 mt-1 px-3 py-2 rounded-xl border">
        <p className="text-xs text-muted-foreground">
          You can use{" "}
          <a
            href="https://www.commonmark.org/help/"
            className="underline text-primary-dark font-medium"
          >
            markdown
          </a>{" "}
          here.
        </p>
        <div className="flex items-center gap-2">
          <Switch
            id="markdown-view"
            checked={view === "markdown"}
            onCheckedChange={(checked: boolean) => {
              setView(checked ? "markdown" : "raw");
            }}
            className="cursor-pointer"
          />
          <Label
            htmlFor="markdown-view"
            className="text-xs text-foreground cursor-pointer"
          >
            Markdown
          </Label>
        </div>
      </div>
      {view === "markdown"
        ? (
          <RichTextArea
            value={weakEscapeHTML(value)}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onPaste={onPaste}
            disabled={disabled}
            placeholder={placeholder}
            className={className}
            enableMentions={enableMentions}
          />
        )
        : (
          <RawTextArea
            value={unescapeHTML(value)}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onPaste={onPaste}
            disabled={disabled}
            placeholder={placeholder}
            className={className}
          />
        )}
    </div>
  );
}
