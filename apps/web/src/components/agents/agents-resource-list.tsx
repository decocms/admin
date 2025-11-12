import { type ReactNode, useMemo, useState } from "react";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import {
  useAgents,
  useRemoveAgent,
  useAuditEvents,
  useCreateAgentV2,
  formatIntegrationId,
  WellKnownMcpGroups,
} from "@deco/sdk";
import { useThread } from "../decopilot/thread-provider.tsx";
import { useFocusChat } from "./hooks.ts";
import { useCreateAgent } from "../../hooks/use-create-agent.ts";
import { useHideLegacyFeatures } from "../../hooks/use-hide-legacy-features.ts";
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
  const { showLegacyFeature } = useHideLegacyFeatures();
  const showLegacy = showLegacyFeature("showLegacyAgents");
  
  // State-based tab management instead of route-based
  const [activeTab, setActiveTab] = useState<"agents" | "threads" | "legacy">("agents");

  // All hooks must be called unconditionally at the top level
  const { data: auditData } = useAuditEvents({
    orderBy: "updatedAt_desc",
    limit: 100,
  });
  const { addTab } = useThread();
  
  // Legacy agents hooks
  const { data: legacyAgents } = useAgents();
  const removeLegacyAgent = useRemoveAgent();
  const createLegacyAgent = useCreateAgent();
  
  // V2 agents hooks (only needed for custom "New Agent" navigation)
  const createAgentV2 = useCreateAgentV2();
  
  const focusChat = useFocusChat();
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tabs = useMemo(() => {
    const baseTabs = [
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
    
    if (showLegacy) {
      baseTabs.push({
        id: "legacy",
        label: "Legacy",
        onClick: () => setActiveTab("legacy"),
      });
    }
    
    return baseTabs;
  }, [showLegacy]);

  const threads = auditData?.threads ?? [];
  const threadsItems = useMemo(() => threads.map(adaptThread), [threads]);
  const legacyAgentsItems = useMemo(() => (legacyAgents ?? []).map(adaptAgent), [legacyAgents]);

  // Handler for creating a new V2 agent
  const handleCreateAgentV2 = async () => {
    const newAgent = await createAgentV2.mutateAsync({
      name: "New Agent",
      description: "",
      system: "You are a helpful assistant.",
      tools: {},
    });
    
    // Navigate to the newly created agent's detail page
    if (newAgent) {
      addTab({
        type: "detail",
        resourceUri: newAgent.uri,
        title: newAgent.data.name || "New Agent",
        icon: "robot_2",
      });
    }
  };
  
  // Handler for creating a legacy agent
  const handleCreateLegacyAgent = async () => {
    const newAgent = {
      name: "New Agent",
      id: crypto.randomUUID(),
      description: "",
      instructions: "",
    };
    await createLegacyAgent(newAgent, { eventName: "agent_create" });
  };

  // CTA button for creating a new V2 agent (default)
  const newAgentButton = (
    <Button variant="default" size="sm" onClick={handleCreateAgentV2}>
      <Icon name="add" />
      New agent
    </Button>
  );
  
  // CTA button for creating a legacy agent
  const newLegacyAgentButton = (
    <Button variant="default" size="sm" onClick={handleCreateLegacyAgent}>
      <Icon name="add" />
      New legacy agent
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

  // Show legacy agents view
  if (activeTab === "legacy") {
    const handleLegacyAgentClick = (item: Record<string, unknown>) => {
      const agent =
        (item._agent as import("@deco/sdk").Agent) ||
        (item as unknown as import("@deco/sdk").Agent);
      focusChat(agent.id, crypto.randomUUID(), { history: false });
    };

    const handleLegacyDuplicate = async (agent: import("@deco/sdk").Agent) => {
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
        await createLegacyAgent(newAgent, { eventName: "agent_duplicate" });
      } catch (error) {
        console.error("Error duplicating agent:", error);
      }
    };

    const handleLegacyDelete = async () => {
      if (!agentToDelete) return;

      setDeleting(true);
      try {
        await removeLegacyAgent.mutateAsync(agentToDelete);
        setAgentToDelete(null);
      } catch (error) {
        console.error("Error deleting agent:", error);
      } finally {
        setDeleting(false);
      }
    };

    return (
      <>
        <ResourcesV2List
          integrationId="i:agent-management"
          resourceName="agent"
          headerSlot={headerSlot}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as "agents" | "threads" | "legacy")}
          customData={legacyAgentsItems}
          customColumns={getAgentsColumns()}
          onItemClick={handleLegacyAgentClick}
          customRowActions={getAgentRowActions({
            onDuplicate: handleLegacyDuplicate,
            onDelete: (id: string) => setAgentToDelete(id),
          })}
          customCtaButton={newLegacyAgentButton}
          customEmptyState={{
            icon: "smart_toy",
            title: "No legacy agents",
            description: "Legacy agents from the database will appear here.",
          }}
        />
        <AlertDialog
          open={!!agentToDelete}
          onOpenChange={(open) => !open && setAgentToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Agent</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this agent? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLegacyDelete} disabled={deleting}>
                {deleting ? <Spinner className="w-4 h-4" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Show V2 agents view (default) - let ResourcesV2List handle everything automatically
  const agentsV2IntegrationId = formatIntegrationId(WellKnownMcpGroups.AgentsV2);

  return (
    <ResourcesV2List
      integrationId={agentsV2IntegrationId}
      resourceName="agent"
      headerSlot={headerSlot}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as "agents" | "threads" | "legacy")}
      customCtaButton={newAgentButton}
    />
  );
}

export default AgentsResourceList;
