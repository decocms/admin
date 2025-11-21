import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { Button } from "./button.tsx";
import { Textarea } from "./textarea.tsx";
import { cn } from "../lib/utils.ts";

interface DecoChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  className?: string;
  actions?: ReactNode;
  rows?: number;
}

export function DecoChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled,
  isStreaming,
  placeholder = "Ask deco chat for help...",
  className,
  actions,
  rows = 3,
}: DecoChatInputProps) {
  const canSubmit = !disabled && !isStreaming && value.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onSubmit();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        onSubmit();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <Textarea
          value={value}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={rows}
          className="resize-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          {actions}
          <Button type="submit" size="sm" disabled={!canSubmit && !isStreaming}>
            Send
          </Button>
          {isStreaming && onStop && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onStop}
            >
              Stop generating
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
