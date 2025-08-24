import { useAgents } from "@deco/sdk";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { DockviewApi } from "dockview-react";
import { Suspense, useMemo, useState } from "react";
import { useCurrentAgent } from "../../hooks/use-current-agent.ts";
import { MainChat } from "../agent/chat.tsx";
import { AgentProvider, useAgent } from "../agent/provider.tsx";
import { AgentVisibility } from "../common/agent-visibility.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";

export const NO_DROP_TARGET = "no-drop-target";

/**
 * Returns true if the decopilot tab is open, false otherwise.
 */
export const toggleDecopilotTab = (api: DockviewApi) => {
  const group = api.getGroup(NO_DROP_TARGET);

  if (group) {
    api.removeGroup(group);
    return false;
  }

  api.addGroup({
    id: NO_DROP_TARGET,
    locked: NO_DROP_TARGET,
    direction: "right",
  });

  api.addPanel({
    id: DecopilotChat.displayName,
    component: DecopilotChat.displayName,
    title: "Default Chat",
    tabComponent: DecopilotTabs.displayName,
    maximumWidth: 512,
  });

  return true;
};

interface AgentSwitcherModalProps {
  currentAgentId: string;
  onAgentSelect: (agentId: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AgentGridSwitcherProps {
  onClick: () => void;
}

function AgentGridSwitcher({ onClick }: AgentGridSwitcherProps) {
  const { data: agents } = useAgents();

  const displayAgents = useMemo(() => {
    const result = agents.slice(0, 4).map((agent) => ({
      id: agent.id,
      avatar: agent.avatar,
      name: agent.name,
    }));

    return result;
  }, [agents]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          type="button"
          className="cursor-pointer bg-accent border relative w-9 h-9 rounded-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
          title="Switch Agent"
        >
          <div className="grid grid-cols-2 p-1 w-full h-full">
            {displayAgents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-center relative w-full h-full rounded-sm overflow-hidden bg-muted/20"
              >
                <AgentAvatar
                  url={agent.avatar}
                  fallback={agent.name}
                  size="3xs"
                  className="border-none"
                />
              </div>
            ))}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Switch Agent</TooltipContent>
    </Tooltip>
  );
}

function AgentSwitcherModalContent({
  currentAgentId,
  onAgentSelect,
}: {
  currentAgentId: string;
  onAgentSelect: (agentId: string) => void;
}) {
  const { data: agents } = useAgents();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAgents = useMemo(() => {
    if (!agents) return [];

    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.description?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [agents, searchTerm]);

  const handleAgentSelect = (agentId: string) => {
    onAgentSelect(agentId);
    setSearchTerm(""); // Reset search when closing
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <Input
        placeholder="Search agents..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-3 px-1">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                agent.id === currentAgentId ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => handleAgentSelect(agent.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AgentAvatar
                    url={agent.avatar}
                    fallback={agent.name}
                    size="base"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{agent.name}</h3>
                      <AgentVisibility.Icon agent={agent} size={16} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {agent.description || "No description"}
                    </p>
                  </div>
                  {agent.id === currentAgentId && (
                    <div className="text-xs text-primary font-medium">
                      Current
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentSwitcherModal({
  currentAgentId,
  onAgentSelect,
  isOpen,
  onOpenChange,
}: AgentSwitcherModalProps) {
  const handleAgentSelect = (agentId: string) => {
    onAgentSelect(agentId);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Switch Agent</DialogTitle>
        </DialogHeader>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          }
        >
          <AgentSwitcherModalContent
            currentAgentId={currentAgentId}
            onAgentSelect={handleAgentSelect}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function DecopilotHeader({
  isAgentSwitcherOpen,
  setIsAgentSwitcherOpen,
}: {
  isAgentSwitcherOpen: boolean;
  setIsAgentSwitcherOpen: (open: boolean) => void;
}) {
  const { agent, chat } = useAgent();

  const messages = chat.messages;

  const isEmpty = messages.length === 0;

  return (
    <div className="p-3 border-b flex items-center justify-between">
      <div className="flex items-center gap-2">
        {!isEmpty && (
          <>
            <AgentAvatar url={agent.avatar} fallback={agent.name} size="sm" />
            <h2 className="font-medium">{agent.name}</h2>
          </>
        )}
      </div>

      <Dialog open={isAgentSwitcherOpen} onOpenChange={setIsAgentSwitcherOpen}>
        <DialogTrigger asChild>
          <div>
            <AgentGridSwitcher onClick={() => setIsAgentSwitcherOpen(true)} />
          </div>
        </DialogTrigger>
      </Dialog>
    </div>
  );
}
export function DecopilotChat() {
  const { currentAgentId, setCurrentAgentId } = useCurrentAgent();
  const [isAgentSwitcherOpen, setIsAgentSwitcherOpen] = useState(false);
  const [threadId, _setThreadId] = useState(() => crypto.randomUUID());
  const team = useCurrentTeam();

  const urlPattern = new URLPattern({ pathname: "/:teamSlug/views/:id" });
  const match = urlPattern.exec(globalThis.location.href);

  const viewId = match?.pathname.groups?.id;

  const view = team.views.find((view) => view.id === viewId);
  const integrationId = view?.metadata?.integration?.id;

  return (
    <div className="flex flex-col h-full">
      <AgentProvider
        key={currentAgentId}
        agentId={currentAgentId}
        threadId={threadId}
        additionalTools={
          integrationId
            ? {
                [integrationId]: [],
              }
            : undefined
        }
        uiOptions={{
          showThreadTools: false,
          showModelSelector: false,
          showThreadMessages: false,
          showAgentVisibility: false,
          showEditAgent: false,
        }}
      >
        <div className="h-[60px]">
          <DecopilotHeader
            isAgentSwitcherOpen={isAgentSwitcherOpen}
            setIsAgentSwitcherOpen={setIsAgentSwitcherOpen}
          />
        </div>
        <div className="h-[calc(100%-60px)]">
          <MainChat />
        </div>
      </AgentProvider>

      <AgentSwitcherModal
        currentAgentId={currentAgentId}
        onAgentSelect={setCurrentAgentId}
        isOpen={isAgentSwitcherOpen}
        onOpenChange={setIsAgentSwitcherOpen}
      />
    </div>
  );
}
DecopilotChat.displayName = "DefaultChat";

export function DecopilotTabs() {
  return null; //<div>display threads in here</div>;
}
DecopilotTabs.displayName = "DefaultChatTabComponent";
