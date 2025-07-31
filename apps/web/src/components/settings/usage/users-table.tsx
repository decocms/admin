import type { Member, ThreadUsage, ThreadUsageItem } from "@deco/sdk";
import { useMemo, useState } from "react";
import { UserAvatar } from "../../common/avatar/user.tsx";
import { Table, type TableColumn } from "../../common/table/index.tsx";
import { color } from "./util.ts";

export function UsersTable({
  threadUsage,
  members,
}: {
  threadUsage: ThreadUsage;
  members: Member[];
}) {
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Aggregate thread usage data by user
  const enrichedUsers = useMemo(() => {
    if (!threadUsage.items || threadUsage.items.length === 0) {
      return [];
    }

    const userMap = new Map<
      string,
      {
        userId: string;
        threads: ThreadUsageItem[];
        totalCost: number;
        totalTokens: number;
        agentIds: Set<string>;
      }
    >();

    // Group threads by user
    threadUsage.items.forEach((thread) => {
      const userId = thread.generatedBy;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          threads: [],
          totalCost: 0,
          totalTokens: 0,
          agentIds: new Set<string>(),
        });
      }

      const userData = userMap.get(userId);

      if (!userData) {
        throw new Error("Could not load thread usage");
      }

      userData.threads.push(thread);

      // Parse the thread cost more carefully - handle dollar sign
      const threadCost =
        typeof thread.total === "string"
          ? parseFloat(thread.total.replace("$", ""))
          : typeof thread.total === "number"
            ? thread.total
            : 0;
      const validCost = isNaN(threadCost) ? 0 : threadCost;

      userData.totalCost += validCost;
      userData.totalTokens += thread.tokens?.totalTokens || 0;
      userData.agentIds.add(thread.agentId);
    });

    // Convert to array and enrich with member information
    const users = Array.from(userMap.values()).map((userData) => {
      const member = members.find((m) => m.profiles.id === userData.userId);

      return {
        ...userData,
        member: member || {
          profiles: {
            id: userData.userId,
            email: "Unknown User",
            metadata: { avatar_url: undefined },
          },
          roles: [],
        },
        color: color(userData.userId),
        agentsUsed: userData.agentIds.size,
        threadsCount: userData.threads.length,
      };
    });

    return users;
  }, [threadUsage.items, members]);

  // Define table columns
  const columns: TableColumn<(typeof enrichedUsers)[0]>[] = [
    {
      id: "color",
      header: "",
      render: (user) => (
        <div
          className="w-3 h-3 rounded"
          style={{ backgroundColor: user.color }}
        />
      ),
    },
    {
      id: "user",
      header: "User",
      render: (user) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            url={user.member.profiles?.metadata?.avatar_url}
            fallback={user.member.profiles?.email || "Unknown"}
            size="sm"
          />
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {user.member.profiles?.email || "Unknown"}
            </span>
            {user.member.roles && user.member.roles.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {user.member.roles[0].name}
              </span>
            )}
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      id: "agentsUsed",
      header: "Agents Used",
      render: (user) => <span className="text-sm">{user.agentsUsed}</span>,
      sortable: true,
    },
    {
      id: "threadsCount",
      header: "Threads Created",
      render: (user) => <span className="text-sm">{user.threadsCount}</span>,
      sortable: true,
    },
    {
      id: "totalTokens",
      header: "Tokens",
      render: (user) => (
        <span className="text-sm">{user.totalTokens.toLocaleString()}</span>
      ),
      sortable: true,
    },
    {
      id: "total",
      header: "Total Cost",
      render: (user) => {
        console.log(
          `Rendering user ${user.userId} total cost:`,
          user.totalCost,
          typeof user.totalCost,
        );
        return (
          <span className="font-medium">$ {user.totalCost.toFixed(2)}</span>
        );
      },
      sortable: true,
    },
  ];

  // Sorting logic
  const getSortValue = (
    user: (typeof enrichedUsers)[0],
    key: string,
  ): string | number => {
    switch (key) {
      case "user":
        return user.member.profiles?.email?.toLowerCase() || "";
      case "agentsUsed":
        return user.agentsUsed;
      case "threadsCount":
        return user.threadsCount;
      case "totalTokens":
        return user.totalTokens;
      case "total":
        return user.totalCost;
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
  const sortedUsers = useMemo(() => {
    return [...enrichedUsers].sort((a, b) => {
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
  }, [enrichedUsers, sortKey, sortDirection]);

  console.log("UsersTable - enrichedUsers:", enrichedUsers);
  console.log("UsersTable - sortedUsers:", sortedUsers);

  return (
    <Table
      columns={columns}
      data={sortedUsers}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
    />
  );
}
