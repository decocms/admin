import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { type ReactNode } from "react";
import { useCopy } from "../../hooks/use-copy";

export function CodeBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { handleCopy, copied } = useCopy({ timeout: 3000 });

  return (
    <div className="relative group">
      <pre
        className={cn(
          "rounded-md bg-muted p-2 text-xs font-mono whitespace-pre-wrap pr-10",
          className,
        )}
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={() => handleCopy(String(children))}
        className="absolute top-0 right-0 p-2 cursor-pointer"
        aria-label="Copy to clipboard"
      >
        <Icon name={copied ? "check" : "content_copy"} />
      </button>
    </div>
  );
}
