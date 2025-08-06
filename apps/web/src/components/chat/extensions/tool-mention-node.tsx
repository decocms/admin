import { IntegrationAvatar } from "../../common/avatar/integration.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { cn } from "@deco/ui/lib/utils.ts";
import { type ToolOption } from "./tool-suggestion.ts";

export default function ToolMentionNode({
  node,
  extension,
}: ReactNodeViewProps<HTMLSpanElement>) {
  const label = node.attrs.label;
  const id = node.attrs.id;

  // Try to get the tool data from the extension
  const items = extension.options.suggestion?.items?.({ query: label }) || [];
  const toolItem = items.find((item: ToolOption) => item.id === id);

  return (
    <NodeViewWrapper as="span" data-id={id} data-type="tool-mention">
      <Badge
        variant="secondary"
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium",
          "bg-accent text-accent-foreground border-border hover:bg-accent/80",
        )}
      >
        <IntegrationAvatar
          url={toolItem?.tool?.integration?.icon}
          fallback={toolItem?.tool?.integration?.name || "Unknown"}
          size="xs"
          className="w-3 h-3"
        />
        <span className="leading-none">
          {toolItem?.tool?.name || label || "Unknown tool"}
        </span>
      </Badge>
    </NodeViewWrapper>
  );
}
