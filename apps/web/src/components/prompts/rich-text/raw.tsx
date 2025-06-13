import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
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
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => onKeyDown?.(e)}
      onKeyUp={(e) => onKeyUp?.(e)}
      onPaste={(e) => onPaste?.(e)}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        "min-h-[80lvh] whitespace-pre-wrap [overflow-wrap:anywhere]",
        className,
      )}
    />
  );
}
