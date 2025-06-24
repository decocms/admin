import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import type { PromptInputProps } from "./index.tsx";

export default function RawTextArea({
  value,
  onChange,
  onKeyDown,
  onKeyUp,
  onPaste,
  disabled,
  placeholder,
  className,
}: PromptInputProps) {
  const [hadUserInteraction, setHadUserInteraction] = useState(false);

  return (
    <Textarea
      value={value}
      onChange={(e) => {
        if (!hadUserInteraction) {
          return;
        }

        onChange(e.target.value);
      }}
      onFocus={() => {
        if (!hadUserInteraction) {
          setHadUserInteraction(true);
        }
      }}
      onKeyDown={(e) => onKeyDown?.(e)}
      onKeyUp={(e) => onKeyUp?.(e)}
      onPaste={(e) => onPaste?.(e)}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        "min-h-[25lvh] whitespace-pre-wrap [overflow-wrap:anywhere]",
        className,
      )}
    />
  );
}
