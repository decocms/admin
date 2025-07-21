import type {
  Agent,
  AgentUsage,
  AgentUsageItem,
  Member,
  ThreadUsage,
} from "@deco/sdk";
import { useMemo } from "react";
import { ChartBarStack, StackedBarChart } from "./stacked-bar-chart.tsx";
import { TimeRange, UsageType } from "./usage.tsx";
import { color } from "./util.ts";

function hourId(transaction: { timestamp: string }): string {
  const date = new Date(transaction.timestamp);
  let hour = date.getHours();
  const isAM = hour < 12;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const period = isAM ? "AM" : "PM";
  return `${hour12}${period}`;
}

function dayId(transaction: { timestamp: string }): string {
  const date = new Date(transaction.timestamp);
  const options = { month: "short", day: "numeric" } as const;
  return date.toLocaleDateString("en-US", options);
}

/**
 * Generates a human-readable week ID string showing the date range (Sun - Sat).
 * Example: "Jan 13 - Jan 20"
 * @param {{ timestamp: string }} transaction - The transaction object.
 * @returns {string} The week range string.
 */
function weekId(transaction: { timestamp: string }): string {
  const date = new Date(transaction.timestamp);

  // Find the start of the week (Sunday)
  const startDate = new Date(date);
  startDate.setDate(date.getDate() - date.getDay()); // setDate handles month/year rollovers
  startDate.setHours(0, 0, 0, 0); // Optional: Reset time to midnight

  // Find the end of the week (Saturday)
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999); // Optional: Set time to the end of the day

  const options = { month: "short", day: "numeric" } as const;

  const startDateString = startDate.toLocaleDateString("en-US", options);
  const endDateString = endDate.toLocaleDateString("en-US", options);

  return `${startDateString} - ${endDateString}`;
}

function allDayHoursKeys(): string[] {
  return Array.from({ length: 24 }, (_, i) => hourId({ timestamp: new Date(new Date().setHours(i, 0, 0, 0)).toISOString() }));
}

function allWeekDaysKeys(): string[] {
  return Array.from({ length: 7 }, (_, i) => dayId({ timestamp: new Date(new Date().setDate(new Date().getDate() - i)).toISOString() })).reverse();
}

function allMonthWeeksKeys(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  
  // Find the first day of the month
  const firstOfMonth = new Date(year, month, 1);
  // Find the last day of the month
  const lastOfMonth = new Date(year, month + 1, 0);

  // Find the Sunday before or on the first of the month
  const firstWeekStart = new Date(firstOfMonth);
  firstWeekStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  firstWeekStart.setHours(0, 0, 0, 0);

  // Find the Saturday after or on the last of the month
  const lastWeekEnd = new Date(lastOfMonth);
  lastWeekEnd.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));
  lastWeekEnd.setHours(23, 59, 59, 999);

  const weekIds: string[] = [];
  let current = new Date(firstWeekStart);

  while (current <= lastWeekEnd) {
    // Generate week ID using the same logic as weekId function
    const weekIdStr = weekId({ timestamp: current.toISOString() });
    weekIds.push(weekIdStr);
    
    // Move to next week (add 7 days)
    current.setDate(current.getDate() + 7);
  }

  return weekIds;
}

function createMap<T extends BaseTransaction>({
  keys,
  fillWith,
  getKey,
}:{
  keys: () => string[],
  fillWith: T[],
  getKey: (transaction: T) => string,
}): Record<string, T[]> {
  const map: Record<string, T[]> = {};

  keys().forEach((key) => {
    if (!map[key]) {
      map[key] = [];
    }
  });

  fillWith.forEach((transaction) => {
    const key = getKey(transaction);
    if (!map[key]) {
      console.warn(`Key ${key} not found in map, creating new entry`);
      map[key] = [];
    }
    map[key].push(transaction);
  });

  return map;
}

interface AgentChartTransaction {
  timestamp: string;
  amount: number;
  agentId: string;
  agentName: string;
  agentAvatar: string;
}

interface BaseTransaction {
  timestamp: string;
  amount: number;
}

type StackBuilder<T extends BaseTransaction> = (opts: {
  transactions: T[],
  label: string,
}) => ChartBarStack;

/**
 * Creates bar stacks for putting into the stacked bar chart.
 */
const createStackBuilder = <T extends BaseTransaction>({
  getKey,
  getType,
  getName,
  getAvatar,
  getAdditionalData,
}: {
  getKey: (transaction: T) => string;
  getName: (transaction: T) => string;
  getAvatar: (transaction: T) => string;
  getAdditionalData: (transaction: T) => Record<string, unknown>;
  getType: () => string;
}): StackBuilder<T> => {
  const buildStack: StackBuilder<T> = ({ transactions, label }) => {
    if (transactions.length === 0) {
      return {
        total: 0,
        label,
        items: [],
      };
    }

    const total = transactions.reduce(
      (sum, transaction) => sum + transaction.amount,
      0,
    );

    const costs = new Map<
      string,
      {
        cost: number;
        name: string;
        avatar: string;
        additionalData: Record<string, unknown>;
      }
    >();

    transactions.forEach((transaction) => {
      const key = getKey(transaction);
      const existing = costs.get(key);
      if (existing) {
        existing.cost += transaction.amount;
      } else {
        costs.set(key, {
          cost: transaction.amount,
          name: getName(transaction),
          avatar: getAvatar(transaction),
          additionalData: getAdditionalData(transaction),
        });
      }
    });

    const top5 = Array.from(costs.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5);

    const top5Data = top5.map(([key, data]) => ({
      id: key,
      name: data.name,
      avatar: data.avatar,
      cost: data.cost,
      color: color(key),
      type: getType(),
      ...(data.additionalData ?? {}),
    }));

    const totalPeriodCost = Array.from(costs.values()).reduce(
      (sum, data) => sum + data.cost,
      0,
    );
    const top5Cost = top5Data.reduce((sum, item) => sum + item.cost, 0);
    const otherCost = Math.max(0, totalPeriodCost - top5Cost);

    const allData = [...top5Data];

    if (otherCost > 0) {
      allData.push({
        id: "other",
        name: "Other",
        avatar: "",
        cost: otherCost,
        color: "#E5E7EB",
        type: getType(),
      });
    }

    return {
      total,
      label,
      items: allData,
    };
  };

  return buildStack;
};

const buildAgentStack = 
  createStackBuilder<AgentChartTransaction>({
    getKey: (transaction) => transaction.agentId,
    getName: (transaction) => transaction.agentName,
    getAvatar: (transaction) => transaction.agentAvatar,
    getAdditionalData: () => ({}),
    getType: () => "agent",
  });

const buildUserStack = 
  createStackBuilder<UserChartTransaction>({
    getKey: (transaction) => transaction.userId,
    getName: (transaction) => transaction.userName,
    getAvatar: () => "",
    getType: () => "user",
    getAdditionalData: (transaction) => ({ member: transaction.member }),
  });

const buildThreadStack = 
  createStackBuilder<ThreadChartTransaction>({
    getKey: (transaction) => transaction.threadId,
    getName: (transaction) => transaction.threadTitle,
    getAvatar: () => "",
    getType: () => "thread",
    getAdditionalData: () => ({}),
  });

export function createAgentChartData(
  agents: Agent[],
  agentUsage: AgentUsage,
  timeRange: TimeRange,
): ChartBarStack[] {
  if (!agentUsage.items || agentUsage.items.length === 0) {
    return [];
  }

  const allTransactions: Array<AgentChartTransaction> = [];

  agentUsage.items.forEach((item) => {
    const agent = agents.find((a) => a.id === item.id);
    if (agent && item.transactions) {
      item.transactions.forEach((transaction) => {
        allTransactions.push({
          timestamp: new Date(transaction.timestamp).toISOString(),
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

  if (timeRange === "day") {
    const keys = allDayHoursKeys();
    const allTransactionsByDay = createMap({
      keys: allDayHoursKeys,
      fillWith: allTransactions,
      getKey: dayId,
    });
    console.log("keys", keys);
    console.log("allTransactionsByDay", Object.keys(allTransactionsByDay));
    console.log("today", dayId({ timestamp: new Date().toISOString() }));
    const todayTransactions =
      allTransactionsByDay[dayId({ timestamp: new Date().toISOString() })];

    if (!todayTransactions) {
      throw new Error("Could not calculate agent chart data for today");
    }

    const allTransactionsByHour = createMap({
      keys: allDayHoursKeys,
      fillWith: todayTransactions,
      getKey: hourId,
    });
    const groups = Object.entries(allTransactionsByHour);
    const chartStackedBars = groups.map(([label, transactions]) => buildAgentStack({
      transactions: transactions ?? [],
      label,
    }));
    return chartStackedBars;
  }

  if (timeRange === "week") {
    const allTransactionsByDay = createMap({
      keys: allWeekDaysKeys,
      fillWith: allTransactions,
      getKey: dayId,
    });
    const groups = Object.entries(allTransactionsByDay);
    const chartStackedBars = groups.map(([label, transactions]) => buildAgentStack({
      transactions: transactions ?? [],
      label,
    }));
    return chartStackedBars;
  }

  if (timeRange === "month") {
    const allTransactionsByWeek = createMap({
      keys: allMonthWeeksKeys,
      fillWith: allTransactions,
      getKey: weekId,
    });
    const groups = Object.entries(allTransactionsByWeek);
    const chartStackedBars = groups.map(([label, transactions]) => buildAgentStack({
      transactions: transactions ?? [],
      label,
    }));
    return chartStackedBars;
  }

  throw new Error("Unknown time Range");
}

interface UserChartTransaction {
  timestamp: string;
  amount: number;
  userId: string;
  userName: string;
  member: Member | null;
}

export function createUserChartData(
  threadUsage: ThreadUsage,
  members: Member[],
  timeRange: string,
): ChartBarStack[] {
  if (!threadUsage.items || threadUsage.items.length === 0) {
    return [];
  }

  const allTransactions: Array<UserChartTransaction> = [];

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

  if (timeRange === "day") {
    const allTransactionsByHour = createMap({
      keys: allDayHoursKeys,
      fillWith: allTransactions,
      getKey: hourId,
    });
    const groups = Object.entries(allTransactionsByHour);
    const chartStackedBars = groups.map(([label, transactions]) => buildUserStack({
      transactions: transactions ?? [],
      label,
    }));
    return chartStackedBars;
  }

  if (timeRange === "week") {
    const allTransactionsByDay = createMap({
      keys: allWeekDaysKeys,
      fillWith: allTransactions,
      getKey: dayId,
    });
    const groups = Object.entries(allTransactionsByDay);
    const chartStackedBars = groups.map(([label, transactions]) => buildUserStack({
      transactions: transactions ?? [],
      label,
    }));
    return chartStackedBars;
  }

  if (timeRange === "month") {
    const allTransactionsByWeek = createMap({
      keys: allMonthWeeksKeys,
      fillWith: allTransactions,
      getKey: weekId,
    });
    const groups = Object.entries(allTransactionsByWeek);
    const chartStackedBars = groups.map(([label, transactions]) => buildUserStack({
      transactions: transactions ?? [],
      label,
    }));
    return chartStackedBars;
  }

  throw new Error("Unknown time Range");
}

interface ThreadChartTransaction {
  timestamp: string;
  amount: number;
  threadId: string;
  threadTitle: string;
}

export function createThreadChartData(
  threadUsage: ThreadUsage,
  timeRange: TimeRange,
): ChartBarStack[] {
  if (!threadUsage.items || threadUsage.items.length === 0) {
    return [];
  }

  const allTransactions: Array<ThreadChartTransaction> = [];

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

  if (timeRange === "day") {
    const allTransactionsByHour = createMap({
      keys: allDayHoursKeys,
      fillWith: allTransactions,
      getKey: hourId,
    });
    const groups = Object.entries(allTransactionsByHour);

    const chartStackedBars = groups.map(([label, transactions]) => buildThreadStack({
      transactions: transactions ?? [],
      label,
    }));
    return chartStackedBars;
  }

  if (timeRange === "week") {
    const allTransactionsByDay = createMap({
      keys: allWeekDaysKeys,
      fillWith: allTransactions,
      getKey: dayId,
    });
    const groups = Object.entries(allTransactionsByDay);

    const chartStackedBars = groups.map(([label, transactions]) => buildThreadStack({
      transactions: transactions ?? [],
      label,
    }));
    return chartStackedBars;
  }

  if (timeRange === "month") {
    const allTransactionsByWeek = createMap({
      keys: allMonthWeeksKeys,
      fillWith: allTransactions,
      getKey: weekId,
    });
    const groups = Object.entries(allTransactionsByWeek);

    const chartStackedBars = groups.map(([label, transactions]) => buildThreadStack({
      transactions: transactions ?? [],
      label,
    }));
    return chartStackedBars;
  }

  throw new Error("Unknown time Range");
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
  timeRange: TimeRange;
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
