import { type ReactNode, useMemo, useState } from "react";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { useAgents, useRemoveAgent, useAuditEvents } from "@deco/sdk";
import { useThread } from "../decopilot/thread-provider.tsx";
import { useFocusChat } from "./hooks.ts";
import { useCreateAgent } from "../../hooks/use-create-agent.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  adaptAgent,
  getAgentsColumns,
  getAgentRowActions,
} from "./agents-list-adapters.tsx";
import { adaptThread, getThreadsColumns } from "./threads-list-adapters.tsx";

/**
 * Agents resource list component that renders the AgentsList
 * with proper canvas tab integration
 */
export function AgentsResourceList({
  headerSlot,
}: {
  headerSlot?: ReactNode;
} = {}) {
  // State-based tab management instead of route-based
  const [activeTab, setActiveTab] = useState<"agents" | "threads">("agents");

  // All hooks must be called unconditionally at the top level
  const { data: auditData } = useAuditEvents({
    orderBy: "updatedAt_desc",
    limit: 100,
  });
  const { addTab } = useThread();
  const { data: agents } = useAgents();
  const removeAgent = useRemoveAgent();
  const createAgent = useCreateAgent();
  const focusChat = useFocusChat();
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tabs = useMemo(() => {
    return [
      {
        id: "agents",
        label: "Agents",
        onClick: () => setActiveTab("agents"),
      },
      {
        id: "threads",
        label: "Threads",
        onClick: () => setActiveTab("threads"),
      },
    ];
  }, []);

  const threads = auditData?.threads ?? [];
  const threadsItems = useMemo(() => threads.map(adaptThread), [threads]);
  const agentsItems = useMemo(() => (agents ?? []).map(adaptAgent), [agents]);

  // Handler for creating a new agent
  const handleCreateAgent = async () => {
    const newAgent = {
      name: "New Agent",
      id: crypto.randomUUID(),
      description: "",
      instructions: "",
    };
    await createAgent(newAgent, { eventName: "agent_create" });
  };

  // CTA button for creating a new agent
  const newAgentButton = (
    <Button variant="default" size="sm" onClick={handleCreateAgent}>
      <Icon name="add" />
      New agent
    </Button>
  );

  // Show threads view if active tab is "threads"
  if (activeTab === "threads") {
    const handleThreadClick = (item: Record<string, unknown>) => {
      const thread =
        (item._thread as { id: string; title?: string | null }) ||
        (item as unknown as { id: string; title?: string | null });
      const resourceUri = `thread://${thread.id}`;
      addTab({
        type: "detail",
        resourceUri,
        title: thread.title || "Thread",
      });
    };

    return (
      <ResourcesV2List
        integrationId="i:agent-management"
        resourceName="agent"
        headerSlot={headerSlot}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as "agents" | "threads")}
        customData={threadsItems}
        customColumns={getThreadsColumns()}
        onItemClick={handleThreadClick}
        customCtaButton={null}
        customEmptyState={{
          icon: "history",
          title: "No threads yet",
          description:
            "Start a conversation with an agent to see threads here.",
        }}
      />
    );
  }

  // Show agents view
  const handleAgentClick = (item: Record<string, unknown>) => {
    const agent =
      (item._agent as import("@deco/sdk").Agent) ||
      (item as unknown as import("@deco/sdk").Agent);
    focusChat(agent.id, crypto.randomUUID(), { history: false });
  };

  const handleDuplicate = async (agent: import("@deco/sdk").Agent) => {
    try {
      const newAgent = {
        name: `${agent.name} (Copy)`,
        id: crypto.randomUUID(),
        description: agent.description,
        instructions: agent.instructions,
        avatar: agent.avatar,
        tools_set: agent.tools_set,
        model: agent.model,
        views: agent.views,
      };
      await createAgent(newAgent, { eventName: "agent_duplicate" });
    } catch (error) {
      console.error("Error duplicating agent:", error);
    }
  };

  const handleDelete = async () => {
    if (!agentToDelete) return;
    try {
      setDeleting(true);
      await removeAgent.mutateAsync(agentToDelete);
    } catch (error) {
      console.error("Error deleting agent:", error);
    } finally {
      setDeleting(false);
      setAgentToDelete(null);
    }
  };

  const handleOpen = (agent: import("@deco/sdk").Agent, uri: string) => {
    addTab({
      type: "detail",
      resourceUri: uri,
      title: agent.name || "Untitled agent",
      icon: "robot_2",
    });
  };

  const agentRowActions = getAgentRowActions(
    (agent) => handleDuplicate(agent),
    (agent) => setAgentToDelete(agent.id),
    handleOpen,
  );

  return (
    <>
      <ResourcesV2List
        integrationId="i:agent-management"
        resourceName="agent"
        headerSlot={headerSlot}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as "agents" | "threads")}
        customData={agentsItems}
        customColumns={getAgentsColumns()}
        customRowActions={agentRowActions}
        onItemClick={handleAgentClick}
        customCtaButton={newAgentButton}
        customEmptyState={{
          icon: "robot_2",
          title: "No agents yet",
          description: "Create your first agent to get started.",
        }}
      />
      <AlertDialog
        open={!!agentToDelete}
        onOpenChange={(open) => !open && setAgentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the agent. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deleting ? (
                <>
                  <Spinner />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default AgentsResourceList;
