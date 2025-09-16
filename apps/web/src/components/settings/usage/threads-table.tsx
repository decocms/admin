import { useMemo, useState } from "react";
import type { Agent, Member, Thread, ThreadUsage } from "@deco/sdk";
import { Table, type TableColumn } from "../../common/table/index.tsx";
import { AgentAvatar } from "../../common/avatar/agent.tsx";
import { color } from "./util.ts";
import { UserAvatar } from "../../common/avatar/user.tsx";
import { useNavigateWorkspace } from "../../../hooks/use-navigate-workspace.ts";

export function ThreadsTable({
  agents,
  threadUsage,
  members,
  threadHistory,
}: {
  agents: Agent[];
  threadUsage: ThreadUsage;
  members: Member[];
  threadHistory: Thread[];
}) {
  const navigate = useNavigateWorkspace();
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Enrich thread data with agent and user information
  const enrichedThreads = useMemo(() => {
    if (!threadUsage.items || threadUsage.items.length === 0) {
      return [];
    }

    return threadUsage.items.map((thread) => {
      const agent = agents.find((a) => a.id === thread.agentId);
      const user = members.find((m) => m.profiles.id === thread.generatedBy);

      // Try to get actual thread details if available
      const threadDetail = threadHistory.find((t) => t.id === thread.id);

      // Ensure totalCost is always a proper number for sorting - handle dollar sign
      const parsedCost =
        typeof thread.total === "string"
          ? parseFloat(thread.total.replace("$", ""))
          : typeof thread.total === "number"
            ? thread.total
            : 0;
      const totalCost = isNaN(parsedCost) ? 0 : parsedCost;

      return {
        ...thread,
        agent: agent || {
          id: thread.agentId,
          name: "Unknown Agent",
          avatar: "",
        },
        user: user || {
          profiles: {
            id: thread.generatedBy,
            email: "Unknown User",
            metadata: {
              avatar_url: "",
              username: "unknown",
              email: "Unknown User",
            },
          },
        },
        color: color(thread.id),
        totalCost,
        // Use actual thread title if available, otherwise use fallback
        title: threadDetail?.title || `Thread ${thread.id.slice(-8)}`,
        updatedAt: threadDetail?.updatedAt || new Date().toISOString(),
      };
    }); // Remove the filter that was hiding all data
  }, [threadUsage.items, agents, members, threadHistory]);

  // Define table columns
  const columns: TableColumn<(typeof enrichedThreads)[0]>[] = [
    {
      id: "color",
      header: "",
      render: (thread) => (
        <div
          className="w-3 h-3 rounded"
          style={{ backgroundColor: thread.color }}
        />
      ),
    },
    {
      id: "title",
      header: "Thread",
      render: (thread) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{thread.title}</span>
          <span className="text-xs text-muted-foreground">
            ID: {thread.id.slice(-8)}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "updatedAt",
      header: "Last Updated",
      render: (thread) => (
        <span className="text-sm text-muted-foreground">
          {new Date(thread.updatedAt).toLocaleDateString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "agent",
      header: "Agent",
      render: (thread) => (
        <div className="flex items-center gap-2">
          <AgentAvatar
            url={thread.agent.avatar}
            fallback={thread.agent.name}
            size="sm"
          />
          <span className="text-sm">{thread.agent.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "user",
      header: "Used by",
      render: (thread) => (
        <div className="flex items-center gap-2">
          <UserAvatar
            url={thread.user.profiles?.metadata?.avatar_url}
            fallback={thread.user.profiles?.email || "Unknown"}
            size="sm"
          />
          <span className="text-sm">
            {thread.user.profiles?.email || "Unknown"}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "total",
      header: "Total Cost",
      render: (thread) => (
        <span className="font-medium">${thread.totalCost.toFixed(2)}</span>
      ),
      sortable: true,
    },
  ];

  // Sorting logic
  const getSortValue = (
    thread: (typeof enrichedThreads)[0],
    key: string,
  ): string | number => {
    switch (key) {
      case "title":
        return thread.title.toLowerCase();
      case "updatedAt":
        return new Date(thread.updatedAt).getTime();
      case "agent":
        return thread.agent.name.toLowerCase();
      case "user":
        return thread.user.profiles?.email?.toLowerCase() || "";
      case "total":
        return thread.totalCost;
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
  const sortedThreads = useMemo(() => {
    return [...enrichedThreads].sort((a, b) => {
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
  }, [enrichedThreads, sortKey, sortDirection]);

  return (
    <Table
      columns={columns}
      data={sortedThreads}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={(thread) => {
        navigate(`/audit/${thread.id}`);
      }}
    />
  );
}
