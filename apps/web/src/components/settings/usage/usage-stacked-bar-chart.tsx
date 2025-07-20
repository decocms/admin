import type { Agent, Member } from "@deco/sdk";
import { useMemo } from "react";
import {
  ChartDayData,
  ChartItemData,
  StackedBarChart,
} from "./stacked-bar-chart.tsx";
import { UsageType } from "./usage.tsx";
import { color } from "./util.ts";

interface UsageItem {
  id: string;
  total: string | number;
  generatedBy?: string;
}

interface ThreadItem extends UsageItem {
  generatedBy: string;
}

function parseCost(cost: string | number): number {
  if (typeof cost === "number") return cost;
  const parsed = parseFloat(cost.replace("$", ""));
  return isNaN(parsed) ? 0 : parsed;
}

function generateDistributionFactors(totalPeriods: number): number[] {
  const factors: number[] = [];

  for (let i = 0; i < totalPeriods; i++) {
    const seed = i * 12345 + totalPeriods * 67890;
    const pseudoRandom = Math.abs(Math.sin(seed)) * 0.5 + 0.5;
    const normalizedIndex = i / (totalPeriods - 1);
    const bellCurve = Math.exp(-Math.pow(normalizedIndex - 0.5, 2) / 0.2);
    const factor = pseudoRandom * (0.5 + bellCurve * 0.5);
    factors.push(factor);
  }

  const sum = factors.reduce((acc, factor) => acc + factor, 0);
  return factors.map((factor) => factor / sum);
}

function getPeriods(timeRange: string): number {
  return timeRange === "day" ? 24 : timeRange === "week" ? 7 : 4;
}

function formatDate(
  date: Date,
  timeRange: string,
  periods: number,
  index: number,
): string {
  const adjustedDate = new Date(date);

  if (timeRange === "day") {
    adjustedDate.setHours(adjustedDate.getHours() - (periods - 1 - index));
    return adjustedDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (timeRange === "week") {
    adjustedDate.setDate(adjustedDate.getDate() - (periods - 1 - index));
    return adjustedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } else {
    const weeksAgo = periods - 1 - index;
    adjustedDate.setDate(adjustedDate.getDate() - (weeksAgo * 7));
    const startWeek = new Date(adjustedDate);
    const endWeek = new Date(adjustedDate);
    endWeek.setDate(endWeek.getDate() + 6);
    return `${
      startWeek.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    }-${endWeek.toLocaleDateString("en-US", { day: "numeric" })}`;
  }
}

function formatFullDate(
  date: Date,
  timeRange: string,
  periods: number,
  index: number,
): string {
  const adjustedDate = new Date(date);

  if (timeRange === "day") {
    adjustedDate.setHours(adjustedDate.getHours() - (periods - 1 - index));
  } else if (timeRange === "week") {
    adjustedDate.setDate(adjustedDate.getDate() - (periods - 1 - index));
  } else {
    const weeksAgo = periods - 1 - index;
    adjustedDate.setDate(adjustedDate.getDate() - (weeksAgo * 7));
  }

  return adjustedDate.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function roundCosts(data: ChartItemData[]): ChartItemData[] {
  const roundedData = data.map((item) => ({
    ...item,
    cost: Math.round(item.cost * 100) / 100,
  }));

  const roundedTotalCost = roundedData.reduce(
    (sum, item) => sum + item.cost,
    0,
  );

  return roundedData.map((item) => ({
    ...item,
    percentage: roundedTotalCost > 0 ? (item.cost / roundedTotalCost) * 100 : 0,
  }));
}

function createAgentChartData(
  agents: Agent[],
  agentUsage: { items?: UsageItem[] },
  timeRange: string,
): ChartDayData[] {
  if (!agentUsage.items || agentUsage.items.length === 0) {
    return [];
  }

  const periods = getPeriods(timeRange);
  const distributionFactors = generateDistributionFactors(periods);

  const agentsWithUsage = agents
    .filter((agent) => agentUsage.items?.some((item) => item.id === agent.id))
    .map((agent) => {
      const usage = agentUsage.items?.find((item) => item.id === agent.id);
      return {
        agent,
        totalCost: usage ? parseCost(usage.total) : 0,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5);

  if (agentsWithUsage.length === 0) {
    return [];
  }

  const allAgentsCost = agentUsage.items?.reduce(
    (sum: number, item) => sum + parseCost(item.total),
    0,
  ) || 0;
  const top5Cost = agentsWithUsage.reduce(
    (sum, item) => sum + item.totalCost,
    0,
  );
  const otherAgentsCost = Math.max(0, allAgentsCost - top5Cost);

  return Array.from({ length: periods }, (_, i) => {
    const periodFactor = distributionFactors[i];
    const date = new Date();

    const top5AgentData = agentsWithUsage.map(({ agent, totalCost }) => ({
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      cost: totalCost * periodFactor,
      color: color(agent.id),
      percentage: 0,
      type: "agent",
    }));

    const allAgentData = [...top5AgentData];

    if (otherAgentsCost > 0) {
      allAgentData.push({
        id: "other",
        name: "Other",
        avatar: "",
        cost: otherAgentsCost * periodFactor,
        color: "#E5E7EB",
        percentage: 0,
        type: "agent",
      });
    }

    const roundedAgentData = roundCosts(allAgentData);
    const total = roundedAgentData.reduce((sum, item) => sum + item.cost, 0);

    return {
      date: formatDate(date, timeRange, periods, i),
      fullDate: formatFullDate(date, timeRange, periods, i),
      items: roundedAgentData,
      total,
    };
  });
}

function createUserChartData(
  threadUsage: { items?: ThreadItem[] },
  members: Member[],
  timeRange: string,
): ChartDayData[] {
  if (!threadUsage.items || threadUsage.items.length === 0) {
    return [];
  }

  const periods = getPeriods(timeRange);
  const distributionFactors = generateDistributionFactors(periods);

  // Group threads by user and calculate total cost per user
  const userMap = new Map<
    string,
    { totalCost: number; member: Member | null }
  >();

  threadUsage.items.forEach((thread) => {
    const userId = thread.generatedBy;
    const threadCost = parseCost(thread.total);

    if (!userMap.has(userId)) {
      const member = members.find((m) => m.profiles.id === userId);
      userMap.set(userId, {
        totalCost: 0,
        member: member || null,
      });
    }

    userMap.get(userId)!.totalCost += threadCost;
  });

  const usersWithCost = Array.from(userMap.entries())
    .map(([userId, data]) => ({
      userId,
      totalCost: data.totalCost,
      member: data.member,
      name: data.member?.profiles?.email || "Unknown User",
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5);

  if (usersWithCost.length === 0) {
    return [];
  }

  const totalUserCost = Array.from(userMap.values()).reduce(
    (sum, user) => sum + user.totalCost,
    0,
  );
  const top5UserCost = usersWithCost.reduce(
    (sum, user) => sum + user.totalCost,
    0,
  );
  const otherUserCost = Math.max(0, totalUserCost - top5UserCost);

  return Array.from({ length: periods }, (_, i) => {
    const periodFactor = distributionFactors[i];
    const date = new Date();

    const top5UserData = usersWithCost.map((
      { userId, totalCost, name, member },
    ) => ({
      id: userId,
      name: name,
      avatar: "",
      cost: totalCost * periodFactor,
      color: color(userId),
      percentage: 0,
      type: "user",
      member: member,
    }));

    const allUserData = [...top5UserData];

    if (otherUserCost > 0) {
      allUserData.push({
        id: "other",
        name: "Other",
        avatar: "",
        cost: otherUserCost * periodFactor,
        color: "#E5E7EB",
        percentage: 0,
        type: "user",
        member: null,
      });
    }

    const roundedUserData = roundCosts(allUserData);
    const total = roundedUserData.reduce((sum, item) => sum + item.cost, 0);

    return {
      date: formatDate(date, timeRange, periods, i),
      fullDate: formatFullDate(date, timeRange, periods, i),
      items: roundedUserData,
      total,
    };
  });
}

function createThreadChartData(
  threadUsage: { items?: ThreadItem[] },
  timeRange: string,
): ChartDayData[] {
  if (!threadUsage.items || threadUsage.items.length === 0) {
    return [];
  }

  const periods = getPeriods(timeRange);
  const distributionFactors = generateDistributionFactors(periods);

  const threadsWithCost = threadUsage.items
    .map((thread) => {
      const totalCost = parseCost(thread.total);
      return {
        ...thread,
        totalCost,
        title: `Thread ${thread.id.slice(-8)}`,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5);

  if (threadsWithCost.length === 0) {
    return [];
  }

  const allThreadsCost = threadUsage.items.reduce((sum: number, thread) => {
    return sum + parseCost(thread.total);
  }, 0);
  const top5ThreadsCost = threadsWithCost.reduce(
    (sum: number, thread: any) => sum + thread.totalCost,
    0,
  );
  const otherThreadsCost = Math.max(0, allThreadsCost - top5ThreadsCost);

  return Array.from({ length: periods }, (_, i) => {
    const periodFactor = distributionFactors[i];
    const date = new Date();

    const top5ThreadData = threadsWithCost.map((
      { id, totalCost, title }: any,
    ) => ({
      id: id,
      name: title,
      avatar: "",
      cost: totalCost * periodFactor,
      color: color(id),
      percentage: 0,
      type: "thread",
    }));

    const allThreadData = [...top5ThreadData];

    if (otherThreadsCost > 0) {
      allThreadData.push({
        id: "other",
        name: "Other",
        avatar: "",
        cost: otherThreadsCost * periodFactor,
        color: "#E5E7EB",
        percentage: 0,
        type: "thread",
      });
    }

    const roundedThreadData = roundCosts(allThreadData);
    const total = roundedThreadData.reduce((sum, item) => sum + item.cost, 0);

    return {
      date: formatDate(date, timeRange, periods, i),
      fullDate: formatFullDate(date, timeRange, periods, i),
      items: roundedThreadData,
      total,
    };
  });
}

export function UsageStackedBarChart({
  agents,
  agentUsage,
  threadUsage,
  members,
  timeRange,
  usageType,
}: {
  agents: Agent[];
  agentUsage: any;
  threadUsage: any;
  members: Member[];
  timeRange: string;
  usageType: UsageType;
}) {
  const chartData = useMemo(() => {
    switch (usageType) {
      case "agent":
        return createAgentChartData(agents, agentUsage, timeRange);
      case "user":
        return createUserChartData(threadUsage, members, timeRange);
      case "thread":
        return createThreadChartData(threadUsage, timeRange);
      default:
        return [];
    }
  }, [agents, agentUsage, threadUsage, members, timeRange, usageType]);

  return <StackedBarChart chartData={chartData} />;
}
