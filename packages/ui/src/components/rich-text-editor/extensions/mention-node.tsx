import { Badge } from "../../badge.tsx";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { cn } from "../../../lib/utils.ts";

interface MentionNodeProps extends ReactNodeViewProps<HTMLSpanElement> {
  IntegrationAvatar?: React.ComponentType<{
    url?: string;
    fallback: string;
    size: string;
    className?: string;
  }>;
  ResourceIcon?: React.ComponentType<{
    className?: string;
  }>;
}

export function MentionNode({
  node,
  IntegrationAvatar,
  ResourceIcon,
}: MentionNodeProps) {
  const mentionType = node.attrs.mentionType;
  const label = node.attrs.label;
  const integrationIcon = node.attrs.integrationIcon;
  const integrationName = node.attrs.integrationName;

  return (
    <NodeViewWrapper
      as="span"
      data-type="mention"
      data-mention-type={mentionType}
      data-tool-id={node.attrs.toolId}
      data-tool-name={node.attrs.toolName}
      data-integration-id={node.attrs.integrationId}
      data-resource-name={node.attrs.resourceName}
      data-resource-uri={node.attrs.resourceUri}
    >
      <Badge
        variant="secondary"
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium",
          "bg-accent text-accent-foreground border-border hover:bg-accent/80",
        )}
      >
        {mentionType === "tool" && IntegrationAvatar && integrationIcon && (
          <IntegrationAvatar
            url={integrationIcon}
            fallback={integrationName || label}
            size="xs"
            className="w-3 h-3"
          />
        )}
        {mentionType === "resource" && ResourceIcon && (
          <ResourceIcon className="w-3 h-3" />
        )}
        <span className="leading-none">@{label}</span>
      </Badge>
    </NodeViewWrapper>
  );
}

