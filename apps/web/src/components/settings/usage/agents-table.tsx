import { useMemo, useState } from "react";
import type { Agent, AgentUsage, AgentUsageItem, ThreadUsage } from "@deco/sdk";
import {
  Table,
  type TableColumn,
} from "@deco/ui/components/resource-table.tsx";
import { AgentAvatar } from "../../common/avatar/agent.tsx";
import { color } from "./util.ts";
import { Dialog } from "@deco/ui/components/dialog.tsx";
import { useWorkspaceLink } from "../../../hooks/use-navigate-workspace.ts";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Link } from "react-router";
import { Icon } from "@deco/ui/components/icon.tsx";

interface AgentUsageMetrics {
  agentUsage: AgentUsageItem;
  totalCost: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  threadsCount: number;
  uniqueUsers: number;
}

function AgentUsageDetailsDialog({
  agent,
  metrics,
  onClose,
}: {
  agent: Agent;
  metrics: AgentUsageMetrics;
  onClose: () => void;
}) {
  const withWorkspaceLink = useWorkspaceLink();

  return (
    <DialogContent className="sm:max-w-[400px] p-6">
      <DialogHeader>
        <DialogTitle>Agent Details</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <AgentAvatar url={agent.avatar} fallback={agent.name} size="lg" />
          <div className="flex flex-col justify-center">
            <span className="text-base font-semibold text-foreground">
              {agent.name}
            </span>
            <span className="text-sm text-muted-foreground mt-1">
              $ {metrics.agentUsage.total} total cost
            </span>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground mb-1">
            Usage Statistics
          </span>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics.uniqueUsers}
              </span>
              <span className="text-xs text-muted-foreground">Users</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics.threadsCount}
              </span>
              <span className="text-xs text-muted-foreground">Threads</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics.totalTokens?.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                Total Tokens
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics.promptTokens?.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                Prompt Tokens
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics.completionTokens?.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                Completion Tokens
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground mb-1">
            Cost Breakdown
          </span>
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-foreground">
              $ {metrics.agentUsage.total}
            </span>
            <span className="text-xs text-muted-foreground">Total Cost</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="mt-2 w-full justify-center"
        >
          <Link
            to={withWorkspaceLink(`/agent/${agent.id}/${crypto.randomUUID()}`)}
            onClick={onClose}
          >
            <Icon name="open_in_new" size={16} />
            View agent
          </Link>
        </Button>
      </div>
    </DialogContent>
  );
}

export function UsageTable({
  agents,
  agentUsage,
  threadUsage,
}: {
  agents: Agent[];
  agentUsage: AgentUsage;
  threadUsage: ThreadUsage;
}) {
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<{
    agent: Agent;
    metrics: AgentUsageMetrics;
  } | null>(null);

  // Combine usage data to get comprehensive metrics per agent
  const enrichedAgents = useMemo(() => {
    return agents
      .map((agent) => {
        const agentUsageData = agentUsage.items?.find(
          (item) => item.id === agent.id,
        );
        const agentThreads =
          threadUsage.items?.filter((thread) => thread.agentId === agent.id) ||
          [];

        // Calculate metrics from thread data
        const totalTokens = agentThreads.reduce(
          (sum, thread) => sum + (thread.tokens?.totalTokens || 0),
          0,
        );
        const promptTokens = agentThreads.reduce(
          (sum, thread) => sum + (thread.tokens?.promptTokens || 0),
          0,
        );
        const completionTokens = agentThreads.reduce(
          (sum, thread) => sum + (thread.tokens?.completionTokens || 0),
          0,
        );
        const threadsCount = agentThreads.length;
        const uniqueUsers = new Set(
          agentThreads.map((thread) => thread.generatedBy),
        ).size;

        const metrics = {
          agentUsage: agentUsageData ?? {
            id: agent.id,
            label: agent.name,
            total: 0,
            transactions: [],
          },
          totalCost: agentUsageData ? agentUsageData.total : 0,
          totalTokens,
          promptTokens,
          completionTokens,
          threadsCount,
          uniqueUsers,
        };

        return {
          ...agent,
          color: color(agent.id),
          metrics,
          // For sorting purposes
          totalCost: metrics.totalCost,
        };
      })
      .filter((agent) => agent.metrics.agentUsage); // Only show agents that have usage data
  }, [agents, agentUsage.items, threadUsage.items]);

  // Define table columns
  const columns: TableColumn<(typeof enrichedAgents)[0]>[] = [
    {
      id: "color",
      header: "",
      render: (agent) => (
        <div
          className="w-3 h-3 rounded"
          style={{ backgroundColor: agent.color }}
        />
      ),
    },
    {
      id: "name",
      header: "Agent",
      render: (agent) => (
        <div className="flex items-center gap-3">
          <AgentAvatar url={agent.avatar} fallback={agent.name} size="sm" />
          <span className="font-medium">{agent.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "users",
      header: "Users",
      render: (agent) => (
        <span className="text-sm">{agent.metrics.uniqueUsers}</span>
      ),
      sortable: true,
    },
    {
      id: "threads",
      header: "Threads",
      render: (agent) => (
        <span className="text-sm">{agent.metrics.threadsCount}</span>
      ),
      sortable: true,
    },
    {
      id: "tokens",
      header: "Tokens",
      render: (agent) => (
        <span className="text-sm">
          {agent.metrics.totalTokens.toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "total",
      header: "Total Cost",
      render: (agent) => (
        <span className="font-medium">
          $ {agent.metrics.agentUsage?.total || "0.00"}
        </span>
      ),
      sortable: true,
    },
  ];

  // Sorting logic
  const getSortValue = (
    agent: (typeof enrichedAgents)[0],
    key: string,
  ): string | number => {
    switch (key) {
      case "name":
        return agent.name.toLowerCase();
      case "users":
        return agent.metrics.uniqueUsers;
      case "threads":
        return agent.metrics.threadsCount;
      case "tokens":
        return agent.metrics.totalTokens;
      case "total":
        return agent.totalCost;
      default:
        return "";
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") =>
        prev === "asc" ? "desc" : "asc",
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Sort the data
  const sortedAgents = useMemo(() => {
    return [...enrichedAgents].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);

      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [enrichedAgents, sortKey, sortDirection]);

  return (
    <>
      <Table
        columns={columns}
        data={sortedAgents}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRowClick={(agent) =>
          setSelectedAgentDetails({ agent, metrics: agent.metrics })
        }
      />

      <Dialog
        open={!!selectedAgentDetails}
        onOpenChange={() => setSelectedAgentDetails(null)}
      >
        {selectedAgentDetails && (
          <AgentUsageDetailsDialog
            agent={selectedAgentDetails.agent}
            metrics={selectedAgentDetails.metrics}
            onClose={() => setSelectedAgentDetails(null)}
          />
        )}
      </Dialog>
    </>
  );
}
