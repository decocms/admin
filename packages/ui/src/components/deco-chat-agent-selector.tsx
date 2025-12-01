import { Icon } from "./icon.tsx";
import {
  ResponsiveSelect,
  ResponsiveSelectContent,
  ResponsiveSelectTrigger,
  ResponsiveSelectValue,
} from "./responsive-select.tsx";
import { cn } from "../lib/utils.ts";
import { memo, useState } from "react";

export interface AgentInfo {
  id: string;
  name: string; // title in some contexts, mapping to name for consistency
  description?: string;
  avatar?: string;
}

const AgentItemContent = memo(function AgentItemContent({
  agent,
  isSelected,
}: {
  agent: AgentInfo;
  isSelected?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 py-3 px-3 hover:bg-accent cursor-pointer rounded-xl",
        isSelected && "bg-accent",
      )}
    >
      {/* Avatar */}
      <div className="border border-border/10 relative rounded-xl shrink-0 size-10 overflow-hidden bg-muted">
        {agent.avatar ? (
          <img
            src={agent.avatar}
            alt={agent.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full flex items-center justify-center text-muted-foreground">
            <Icon name="robot" className="size-5" />
          </div>
        )}
      </div>

      {/* Text Content */}
      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground truncate">
            {agent.name}
          </span>
          {isSelected && (
            <Icon name="check" className="size-4 text-foreground shrink-0" />
          )}
        </div>
        {agent.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {agent.description}
          </p>
        )}
      </div>
    </div>
  );
});

function SelectedAgentDisplay({ agent }: { agent: AgentInfo | undefined }) {
  if (!agent) {
    return <span className="text-sm text-muted-foreground">Select agent</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {agent.avatar && (
        <img
          src={agent.avatar}
          alt={agent.name}
          className="size-5 rounded-md object-cover"
        />
      )}
      <span className="text-sm font-medium text-foreground truncate">
        {agent.name}
      </span>
    </div>
  );
}

export interface DecoChatAgentSelectorProps {
  agents: AgentInfo[];
  selectedAgentId?: string;
  onAgentChange: (agentId: string) => void;
  variant?: "borderless" | "bordered";
  className?: string;
  placeholder?: string;
}

/**
 * Rich agent selector with avatar, name, and description
 */
export function DecoChatAgentSelector({
  agents,
  selectedAgentId,
  onAgentChange,
  variant = "bordered",
  className,
  placeholder = "Select agent",
}: DecoChatAgentSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleAgentChange = (agentId: string) => {
    onAgentChange(agentId);
    setOpen(false);
  };

  if (agents.length === 0) {
    return null;
  }

  return (
    <ResponsiveSelect
      open={open}
      onOpenChange={setOpen}
      value={selectedAgentId || ""}
      onValueChange={handleAgentChange}
    >
      <ResponsiveSelectTrigger
        className={cn(
          "h-8! text-sm hover:bg-accent rounded-lg py-1 px-2 gap-1 shadow-none cursor-pointer group focus-visible:ring-0 focus-visible:ring-offset-0",
          variant === "borderless" ? "border-0 md:border-none" : "border",
          className,
        )}
      >
        <ResponsiveSelectValue placeholder={placeholder}>
          <SelectedAgentDisplay agent={selectedAgent} />
        </ResponsiveSelectValue>
      </ResponsiveSelectTrigger>
      <ResponsiveSelectContent
        title={placeholder}
        className="w-full md:w-[400px] p-0"
      >
        <div className="flex flex-col max-h-[400px]">
          {/* Search/Header area could go here if needed */}
          <div className="border-b px-4 py-3 bg-background/95 backdrop-blur sticky top-0 z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon name="search" className="size-4" />
              <span className="text-sm">Search for an agent...</span>
            </div>
          </div>

          <div className="overflow-y-auto p-2 flex flex-col gap-1">
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => handleAgentChange(agent.id)}
                className="outline-none"
              >
                <AgentItemContent
                  agent={agent}
                  isSelected={agent.id === selectedAgentId}
                />
              </div>
            ))}
          </div>
        </div>
      </ResponsiveSelectContent>
    </ResponsiveSelect>
  );
}
