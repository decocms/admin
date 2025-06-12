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
      <div className="flex items-center gap-2 mb-3 mt-1">
        <Switch
          id="markdown-view"
          checked={view === "markdown"}
          onCheckedChange={(checked: boolean) => {
            setView(checked ? "markdown" : "raw");
          }}
        />
        <Label htmlFor="markdown-view" className="text-xs text-foreground">
          Markdown
        </Label>
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
