import type { Agent, AgentUsage, Member, ThreadUsage } from "@deco/sdk";
import { useMemo } from "react";
import {
  ChartDayData,
  ChartItemData,
  StackedBarChart,
} from "./stacked-bar-chart.tsx";
import { UsageType } from "./usage.tsx";
import { color } from "./util.ts";

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
  agentUsage: AgentUsage,
  timeRange: string,
): ChartDayData[] {
  if (!agentUsage.items || agentUsage.items.length === 0) {
    return [];
  }

  // Collect all transactions from all agents
  const allTransactions: Array<{
    timestamp: string;
    amount: number;
    agentId: string;
    agentName: string;
    agentAvatar: string;
  }> = [];

  agentUsage.items.forEach((item) => {
    const agent = agents.find((a) => a.id === item.id);
    if (agent && item.transactions) {
      item.transactions.forEach((transaction) => {
        allTransactions.push({
          timestamp: transaction.timestamp,
          amount: transaction.amount,
          agentId: item.id,
          agentName: agent.name,
          agentAvatar: agent.avatar,
        });
      });
    }
  });

  if (allTransactions.length === 0) {
    return [];
  }

  // Group transactions by time periods based on timeRange
  const periods = timeRange === "day" ? 24 : timeRange === "week" ? 7 : 4;
  const now = new Date();
  const periodData: ChartDayData[] = [];

  for (let i = 0; i < periods; i++) {
    const periodStart = new Date(now);
    const periodEnd = new Date(now);

    if (timeRange === "day") {
      periodStart.setHours(periodStart.getHours() - (periods - 1 - i));
      periodEnd.setHours(periodEnd.getHours() - (periods - 1 - i - 1));
    } else if (timeRange === "week") {
      periodStart.setDate(periodStart.getDate() - (periods - 1 - i));
      periodEnd.setDate(periodEnd.getDate() - (periods - 1 - i - 1));
    } else {
      const weeksAgo = periods - 1 - i;
      periodStart.setDate(periodStart.getDate() - (weeksAgo * 7));
      periodEnd.setDate(periodEnd.getDate() - ((weeksAgo - 1) * 7));
    }

    // Filter transactions for this period
    const periodTransactions = allTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.timestamp);
      return transactionDate >= periodStart && transactionDate < periodEnd;
    });

    // Group by agent and calculate costs
    const agentCosts = new Map<
      string,
      { cost: number; name: string; avatar: string }
    >();

    periodTransactions.forEach((transaction) => {
      const existing = agentCosts.get(transaction.agentId);
      if (existing) {
        existing.cost += transaction.amount;
      } else {
        agentCosts.set(transaction.agentId, {
          cost: transaction.amount,
          name: transaction.agentName,
          avatar: transaction.agentAvatar,
        });
      }
    });

    // Get top 5 agents for this period
    const top5Agents = Array.from(agentCosts.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5);

    const top5AgentData = top5Agents.map(([agentId, data]) => ({
      id: agentId,
      name: data.name,
      avatar: data.avatar,
      cost: data.cost,
      color: color(agentId),
      percentage: 0,
      type: "agent",
    }));

    // Calculate "Other" category
    const totalPeriodCost = Array.from(agentCosts.values()).reduce(
      (sum, data) => sum + data.cost,
      0,
    );
    const top5Cost = top5AgentData.reduce((sum, item) => sum + item.cost, 0);
    const otherCost = Math.max(0, totalPeriodCost - top5Cost);

    const allAgentData = [...top5AgentData];

    if (otherCost > 0) {
      allAgentData.push({
        id: "other",
        name: "Other",
        avatar: "",
        cost: otherCost,
        color: "#E5E7EB",
        percentage: 0,
        type: "agent",
      });
    }

    const roundedAgentData = roundCosts(allAgentData);
    const total = roundedAgentData.reduce((sum, item) => sum + item.cost, 0);

    // Format date for display
    let dateLabel: string;
    if (timeRange === "day") {
      dateLabel = periodStart.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (timeRange === "week") {
      dateLabel = periodStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } else {
      const endWeek = new Date(periodStart);
      endWeek.setDate(endWeek.getDate() + 6);
      dateLabel = `${
        periodStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      }-${endWeek.toLocaleDateString("en-US", { day: "numeric" })}`;
    }

    periodData.push({
      date: dateLabel,
      fullDate: periodStart.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      items: roundedAgentData,
      total,
    });
  }

  return periodData;
}

function createUserChartData(
  threadUsage: ThreadUsage,
  members: Member[],
  timeRange: string,
): ChartDayData[] {
  if (!threadUsage.items || threadUsage.items.length === 0) {
    return [];
  }

  // Collect all transactions from all threads
  const allTransactions: Array<{
    timestamp: string;
    amount: number;
    userId: string;
    userName: string;
    member: Member | null;
  }> = [];

  threadUsage.items.forEach((thread) => {
    const member = members.find((m) => m.profiles.id === thread.generatedBy);
    if (thread.transactions) {
      thread.transactions.forEach((transaction) => {
        allTransactions.push({
          timestamp: transaction.timestamp,
          amount: transaction.amount,
          userId: thread.generatedBy,
          userName: member?.profiles?.email || "Unknown User",
          member: member || null,
        });
      });
    }
  });

  if (allTransactions.length === 0) {
    return [];
  }

  // Group transactions by time periods based on timeRange
  const periods = timeRange === "day" ? 24 : timeRange === "week" ? 7 : 4;
  const now = new Date();
  const periodData: ChartDayData[] = [];

  for (let i = 0; i < periods; i++) {
    const periodStart = new Date(now);
    const periodEnd = new Date(now);

    if (timeRange === "day") {
      periodStart.setHours(periodStart.getHours() - (periods - 1 - i));
      periodEnd.setHours(periodEnd.getHours() - (periods - 1 - i - 1));
    } else if (timeRange === "week") {
      periodStart.setDate(periodStart.getDate() - (periods - 1 - i));
      periodEnd.setDate(periodEnd.getDate() - (periods - 1 - i - 1));
    } else {
      const weeksAgo = periods - 1 - i;
      periodStart.setDate(periodStart.getDate() - (weeksAgo * 7));
      periodEnd.setDate(periodEnd.getDate() - ((weeksAgo - 1) * 7));
    }

    // Filter transactions for this period
    const periodTransactions = allTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.timestamp);
      return transactionDate >= periodStart && transactionDate < periodEnd;
    });

    // Group by user and calculate costs
    const userCosts = new Map<
      string,
      { cost: number; name: string; member: Member | null }
    >();

    periodTransactions.forEach((transaction) => {
      const existing = userCosts.get(transaction.userId);
      if (existing) {
        existing.cost += transaction.amount;
      } else {
        userCosts.set(transaction.userId, {
          cost: transaction.amount,
          name: transaction.userName,
          member: transaction.member,
        });
      }
    });

    // Get top 5 users for this period
    const top5Users = Array.from(userCosts.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5);

    const top5UserData = top5Users.map(([userId, data]) => ({
      id: userId,
      name: data.name,
      avatar: "",
      cost: data.cost,
      color: color(userId),
      percentage: 0,
      type: "user",
      member: data.member,
    }));

    // Calculate "Other" category
    const totalPeriodCost = Array.from(userCosts.values()).reduce(
      (sum, data) => sum + data.cost,
      0,
    );
    const top5Cost = top5UserData.reduce((sum, item) => sum + item.cost, 0);
    const otherCost = Math.max(0, totalPeriodCost - top5Cost);

    const allUserData = [...top5UserData];

    if (otherCost > 0) {
      allUserData.push({
        id: "other",
        name: "Other",
        avatar: "",
        cost: otherCost,
        color: "#E5E7EB",
        percentage: 0,
        type: "user",
        member: null,
      });
    }

    const roundedUserData = roundCosts(allUserData);
    const total = roundedUserData.reduce((sum, item) => sum + item.cost, 0);

    // Format date for display
    let dateLabel: string;
    if (timeRange === "day") {
      dateLabel = periodStart.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (timeRange === "week") {
      dateLabel = periodStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } else {
      const endWeek = new Date(periodStart);
      endWeek.setDate(endWeek.getDate() + 6);
      dateLabel = `${
        periodStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      }-${endWeek.toLocaleDateString("en-US", { day: "numeric" })}`;
    }

    periodData.push({
      date: dateLabel,
      fullDate: periodStart.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      items: roundedUserData,
      total,
    });
  }

  return periodData;
}

function createThreadChartData(
  threadUsage: ThreadUsage,
  timeRange: string,
): ChartDayData[] {
  if (!threadUsage.items || threadUsage.items.length === 0) {
    return [];
  }

  // Collect all transactions from all threads
  const allTransactions: Array<{
    timestamp: string;
    amount: number;
    threadId: string;
    threadTitle: string;
  }> = [];

  threadUsage.items.forEach((thread) => {
    if (thread.transactions) {
      thread.transactions.forEach((transaction) => {
        allTransactions.push({
          timestamp: transaction.timestamp,
          amount: transaction.amount,
          threadId: thread.id,
          threadTitle: `Thread ${thread.id.slice(-8)}`,
        });
      });
    }
  });

  if (allTransactions.length === 0) {
    return [];
  }

  // Group transactions by time periods based on timeRange
  const periods = timeRange === "day" ? 24 : timeRange === "week" ? 7 : 4;
  const now = new Date();
  const periodData: ChartDayData[] = [];

  for (let i = 0; i < periods; i++) {
    const periodStart = new Date(now);
    const periodEnd = new Date(now);

    if (timeRange === "day") {
      periodStart.setHours(periodStart.getHours() - (periods - 1 - i));
      periodEnd.setHours(periodEnd.getHours() - (periods - 1 - i - 1));
    } else if (timeRange === "week") {
      periodStart.setDate(periodStart.getDate() - (periods - 1 - i));
      periodEnd.setDate(periodEnd.getDate() - (periods - 1 - i - 1));
    } else {
      const weeksAgo = periods - 1 - i;
      periodStart.setDate(periodStart.getDate() - (weeksAgo * 7));
      periodEnd.setDate(periodEnd.getDate() - ((weeksAgo - 1) * 7));
    }

    // Filter transactions for this period
    const periodTransactions = allTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.timestamp);
      return transactionDate >= periodStart && transactionDate < periodEnd;
    });

    // Group by thread and calculate costs
    const threadCosts = new Map<string, { cost: number; title: string }>();

    periodTransactions.forEach((transaction) => {
      const existing = threadCosts.get(transaction.threadId);
      if (existing) {
        existing.cost += transaction.amount;
      } else {
        threadCosts.set(transaction.threadId, {
          cost: transaction.amount,
          title: transaction.threadTitle,
        });
      }
    });

    // Get top 5 threads for this period
    const top5Threads = Array.from(threadCosts.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5);

    const top5ThreadData = top5Threads.map(([threadId, data]) => ({
      id: threadId,
      name: data.title,
      avatar: "",
      cost: data.cost,
      color: color(threadId),
      percentage: 0,
      type: "thread",
    }));

    // Calculate "Other" category
    const totalPeriodCost = Array.from(threadCosts.values()).reduce(
      (sum, data) => sum + data.cost,
      0,
    );
    const top5Cost = top5ThreadData.reduce((sum, item) => sum + item.cost, 0);
    const otherCost = Math.max(0, totalPeriodCost - top5Cost);

    const allThreadData = [...top5ThreadData];

    if (otherCost > 0) {
      allThreadData.push({
        id: "other",
        name: "Other",
        avatar: "",
        cost: otherCost,
        color: "#E5E7EB",
        percentage: 0,
        type: "thread",
      });
    }

    const roundedThreadData = roundCosts(allThreadData);
    const total = roundedThreadData.reduce((sum, item) => sum + item.cost, 0);

    // Format date for display
    let dateLabel: string;
    if (timeRange === "day") {
      dateLabel = periodStart.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (timeRange === "week") {
      dateLabel = periodStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } else {
      const endWeek = new Date(periodStart);
      endWeek.setDate(endWeek.getDate() + 6);
      dateLabel = `${
        periodStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      }-${endWeek.toLocaleDateString("en-US", { day: "numeric" })}`;
    }

    periodData.push({
      date: dateLabel,
      fullDate: periodStart.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      items: roundedThreadData,
      total,
    });
  }

  return periodData;
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
  agentUsage: AgentUsage;
  threadUsage: ThreadUsage;
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
