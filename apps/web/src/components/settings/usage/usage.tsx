import {
  useAgents,
  useThreads,
  useUsagePerAgent,
  useUsagePerThread,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { Suspense, useMemo, useState } from "react";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";

import { useMembersWithUnknownUsers } from "./members.ts";
import { UsageFilters } from "./filters.tsx";
import { UsageTable } from "./agents-table.tsx";
import { ThreadsTable } from "./threads-table.tsx";
import { UsersTable } from "./users-table.tsx";
import { UsageStackedBarChart } from "./usage-stacked-bar-chart.tsx";

const useAgentsMergedWithWellKnown = () => {
  const agents = useAgents();
  return {
    ...agents,
    data: agents.data?.concat([
      WELL_KNOWN_AGENTS.teamAgent,
      WELL_KNOWN_AGENTS.setupAgent,
    ]) || [],
  };
};

export type UsageType = "agent" | "thread" | "user";
export type TimeRange = "day" | "week" | "month";

const labelsByUsageType = {
  agent: {
    title: "Agents used",
    plural: "agents",
  },
  thread: {
    title: "Threads created",
    plural: "threads",
  },
  user: {
    title: "Users active",
    plural: "users",
  },
} as const;

export function Usage() {
  const [usageType, setUsageType] = useState<UsageType>("agent");
  const [timeRange, setTimeRange] = useState<TimeRange>("week");

  const agents = useAgentsMergedWithWellKnown();
  const agentUsage = useUsagePerAgent({
    range: timeRange,
  });
  const threadUsage = useUsagePerThread({
    range: timeRange,
  });

  const teamMembers = useMembersWithUnknownUsers({
    userIdsToEnsureExist: threadUsage.items.map((thread) => thread.generatedBy),
  });
  const currentUserThreads = useThreads({
    limit: 20,
    orderBy: "updatedAt_desc",
  });

  const totals = useMemo(() => {
    if (usageType === "agent") {
      const count = agentUsage.items?.length || 0;
      const rawCost = agentUsage.total || "0.00";
      // Parse the cost to remove any existing dollar sign and format consistently
      const parsedCost = typeof rawCost === "string"
        ? parseFloat(rawCost.replace("$", ""))
        : (typeof rawCost === "number" ? rawCost : 0);
      const cost = isNaN(parsedCost) ? 0 : parsedCost;
      const formattedCost = cost.toFixed(2);
      return {
        count,
        cost: formattedCost,
      };
    }

    if (usageType === "thread") {
      const count = threadUsage.items?.length || 0;
      const cost = threadUsage.items?.reduce((sum, thread) => {
        const parsedCost = typeof thread.total === "string"
          ? parseFloat(thread.total.replace("$", ""))
          : (typeof thread.total === "number" ? thread.total : 0);
        const validCost = isNaN(parsedCost) ? 0 : parsedCost;
        return sum + validCost;
      }, 0) || 0;
      const formattedCost = cost.toFixed(2);
      return {
        count,
        cost: formattedCost,
      };
    }

    if (usageType === "user") {
      // Calculate unique users from threadUsage
      const uniqueUsers = new Set(
        threadUsage.items?.map((thread) => thread.generatedBy) || [],
      );
      const totalUserCost = threadUsage.items?.reduce((sum, thread) => {
        const parsedCost = typeof thread.total === "string"
          ? parseFloat(thread.total.replace("$", ""))
          : (typeof thread.total === "number" ? thread.total : 0);
        const validCost = isNaN(parsedCost) ? 0 : parsedCost;
        return sum + validCost;
      }, 0) || 0;
      const formattedCost = totalUserCost.toFixed(2);

      return {
        count: uniqueUsers.size,
        cost: formattedCost,
      };
    }

    throw new Error(`Unknown usage type selected: ${usageType}`);
  }, [usageType, agentUsage, threadUsage]);

  const labels = useMemo(() => labelsByUsageType[usageType], [usageType]);

  return (
    <div className="h-full text-foreground px-6 py-6 overflow-x-auto w-full">
      <div className="flex flex-col gap-6 overflow-x-auto w-full">
        <UsageFilters
          usageType={usageType}
          setUsageType={setUsageType}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
        />

        <div className="flex gap-4 w-full">
          <Card className="flex-1 p-6 rounded-xl border">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="robot_2" size={16} />
                <span className="text-sm font-medium text-muted-foreground">
                  {labels.title}
                </span>
              </div>
              <div className="text-4xl font-normal text-foreground">
                {totals.count} {labels.plural}
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 p-6 rounded-xl bg-primary-dark text-primary-light">
            <CardContent className="p-0">
              <div className="text-sm font-medium mb-2">Total Cost</div>
              <div className="text-4xl font-semibold">${totals.cost}</div>
            </CardContent>
          </Card>
        </div>

        <UsageStackedBarChart
          agents={agents.data || []}
          agentUsage={agentUsage}
          threadUsage={threadUsage}
          members={teamMembers || []}
          timeRange={timeRange}
          usageType={usageType}
        />

        {usageType === "agent" && (
          <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
            <UsageTable
              agents={agents.data || []}
              agentUsage={agentUsage}
              threadUsage={threadUsage}
            />
          </Suspense>
        )}

        {usageType === "thread" && (
          <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
            <ThreadsTable
              agents={agents.data || []}
              threadUsage={threadUsage}
              members={teamMembers}
              currentUserThreads={currentUserThreads.data?.threads || []}
            />
          </Suspense>
        )}

        {usageType === "user" && (
          <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
            <UsersTable
              threadUsage={threadUsage}
              members={teamMembers}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
