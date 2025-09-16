import { IntegrationAvatar } from "../../common/avatar/integration.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { cn } from "@deco/ui/lib/utils.ts";
import { type ResourceOption, type ToolOption } from "./tool-suggestion.ts";

export default function ToolMentionNode({
  node,
  extension,
}: ReactNodeViewProps<HTMLSpanElement>) {
  const label = node.attrs.label;
  const id = node.attrs.id;

  // Try to get the item data from the extension (may be tool or resource)
  const maybeItems = extension.options.suggestion?.items?.({ query: label });
  const items = Array.isArray(maybeItems) ? maybeItems : [];
  const item = items.find((it: ToolOption | ResourceOption) => it.id === id) as
    | ToolOption
    | ResourceOption
    | undefined;
  const isTool = item && (item as ToolOption).type === "tool";
  const integration = isTool
    ? (item as ToolOption).tool.integration
    : (item as ResourceOption | undefined)?.integration;
  const displayLabel = isTool
    ? (item as ToolOption).tool.name
    : ((item as ResourceOption | undefined)?.label ?? label ?? "Unknown");

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
          url={integration?.icon}
          fallback={integration?.name || "Unknown"}
          size="xs"
          className="w-3 h-3"
        />
        <span className="leading-none">{displayLabel}</span>
      </Badge>
    </NodeViewWrapper>
  );
}
