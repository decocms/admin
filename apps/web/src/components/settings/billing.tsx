import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useCurrentTeam } from "../sidebar/TeamSelector.tsx";
import { Link } from "react-router";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@deco/ui/components/chart.tsx";
import { Label, Pie, PieChart } from "recharts";
import { DepositDialog } from "../wallet/DepositDialog.tsx";
import {
  getWalletAccount,
  getWalletInsights,
  getWalletStatements,
  useAgents,
  useSDK,
} from "@deco/sdk";
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Suspense, useState } from "react";
import { useWorkspaceLink } from "../../hooks/useNavigateWorkspace.ts";

function AccountBalance() {
  const { workspace } = useSDK();
  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => getWalletAccount(workspace),
  });

  if (isLoading) return <Skeleton className="w-32 h-12" />;
  if (error) return <p>Error loading wallet</p>;

  return <p className="text-5xl font-bold">{data?.balance}</p>;
}

function AccountStatements() {
  const [cursor, setCursor] = useState("");
  const { workspace } = useSDK();
  const { data: statements, isLoading, error, isFetching } = useQuery({
    queryKey: ["wallet-statements", workspace, cursor],
    queryFn: () => getWalletStatements(workspace, cursor),
    placeholderData: keepPreviousData,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-gray-500">Error loading statements</p>;
  if (!statements?.items.length) {
    return <p className="text-gray-500">No activity yet</p>;
  }

  console.log(statements.items);
  return (
    <div className="flex flex-col gap-3">
      {statements.items.map((statement) => (
        <Dialog key={statement.id}>
          <DialogTrigger asChild>
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    statement.type === "credit"
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-50 text-gray-600"
                  }`}
                >
                  {statement.icon
                    ? <Icon name={statement.icon} size={16} />
                    : (
                      <Icon
                        name={statement.type === "credit"
                          ? "paid"
                          : "data_usage"}
                        size={16}
                      />
                    )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {statement.title}
                  </p>
                  {statement.description && (
                    <p className="text-sm text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap max-w-[280px]">
                      {statement.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(statement.timestamp).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              </div>
              <p
                className={`font-medium ${
                  statement.type === "credit"
                    ? "text-green-600"
                    : "text-gray-900"
                }`}
              >
                {statement.amountExact}
              </p>
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      statement.type === "credit"
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {statement.icon
                      ? <Icon name={statement.icon} size={20} />
                      : (
                        <Icon
                          name={statement.type === "credit"
                            ? "paid"
                            : "data_usage"}
                          size={20}
                        />
                      )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {statement.title}
                    </p>
                    <p
                      className={`text-lg font-medium ${
                        statement.type === "credit"
                          ? "text-green-600"
                          : "text-gray-900"
                      }`}
                    >
                      {statement.amountExact}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    {new Date(statement.timestamp).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                  {statement.description && (
                    <p className="text-sm text-gray-600">
                      {statement.description}
                    </p>
                  )}
                </div>

                {statement.metadata && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">
                      Details
                    </p>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-100">
                        {Object.entries(statement.metadata).map((
                          [key, value],
                        ) => (
                          <tr key={key}>
                            <td className="py-2 text-gray-500">{key}</td>
                            <td className="py-2 text-gray-900 text-right overflow-hidden text-ellipsis whitespace-nowrap max-w-[100px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                    <span>{value as string}</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {value as string}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ))}
      {isFetching ? <div>Loading more...</div> : null}
      {statements?.nextCursor && (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => setCursor(statements.nextCursor)}
        >
          Load more
        </Button>
      )}
    </div>
  );
}

function BalanceCard() {
  const team = useCurrentTeam();

  return (
    <Card className="w-full max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border border-slate-200">
      <div className="w-full text-sm mb-8">
        AI Usage Wallet
      </div>
      <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
        <div className="flex items-center gap-1 text-base mb-1">
          {team.label}
          <Icon
            name="visibility"
            size={18}
            className="ml-1 align-middle text-muted-foreground"
          />
        </div>
        <div className="mb-6">
          <AccountBalance />
        </div>
        <DepositDialog />
      </CardContent>
    </Card>
  );
}

function color(id: string) {
  const colors = [
    "#FF6B6B", // coral red
    "#4ECDC4", // turquoise
    "#45B7D1", // sky blue
    "#96CEB4", // sage green
    "#FFEEAD", // cream
    "#D4A5A5", // dusty rose
    "#9B59B6", // purple
    "#3498DB", // blue
    "#E67E22", // orange
    "#2ECC71", // emerald
    "#F1C40F", // yellow
    "#1ABC9C", // teal
    "#E74C3C", // red
    "#34495E", // navy
    "#16A085", // green
    "#D35400", // dark orange
    "#8E44AD", // violet
    "#2980B9", // dark blue
    "#27AE60", // forest green
    "#C0392B", // burgundy
  ];

  // Use the first part of the ID as a seed for consistent colors
  const seed = id.split("-")[0];
  const hash = seed.split("").reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  return colors[hash % colors.length];
}

function CreditsUsedPerAgentCard({
  agents: workspaceAgents,
}: {
  agents: ReturnType<typeof useAgents>;
}) {
  const { workspace } = useSDK();
  const [insightsQuery, setInsightsQuery] = useState<{
    type: "credits_used_by_agent";
    range: "day" | "week" | "month";
  }>({
    type: "credits_used_by_agent",
    range: "month",
  });
  const [top5Only, setTop5Only] = useState(false);
  const { data: insights } = useSuspenseQuery({
    queryKey: [
      "wallet-insights",
      workspace,
      insightsQuery.type,
      insightsQuery.range,
    ],
    queryFn: () => getWalletInsights(workspace, insightsQuery),
  });
  const withWorkpaceLink = useWorkspaceLink();

  const total = insights.total;
  const enrichedAgents = insights.items.map((_agent) => {
    const agent = workspaceAgents.data?.find((a) => a.id === _agent.id);
    return {
      id: _agent.id,
      total: _agent.total,
      avatar: agent?.avatar,
      label: agent?.name || _agent.label || _agent.id,
      color: color(_agent.id),
    };
  }).sort((a, b) => b.total - a.total).slice(0, top5Only ? 5 : undefined);

  const chartConfig = Object.fromEntries(
    enrichedAgents.map((agent) => [
      agent.id,
      {
        label: agent.label,
        color: agent.color,
      },
    ]),
  ) satisfies ChartConfig;

  const agentsChartData = enrichedAgents.map((agent) => ({
    agentId: agent.id,
    total: agent.total,
    fill: agent.color,
  }));

  return (
    <Card className="w-full max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border border-slate-200">
      <div className="w-full text-sm mb-8 flex justify-between items-center">
        <span>Credits Used Per Agent</span>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={top5Only ? "default" : "outline"}
                className="!h-7 !w-7 text-xs"
                size="icon"
                onClick={() => setTop5Only((prev) => !prev)}
              >
                <Icon name="format_list_numbered" size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Top 5 only
            </TooltipContent>
          </Tooltip>
          <Select
            value={insightsQuery.range}
            onValueChange={(value: "day" | "week" | "month") =>
              setInsightsQuery((prev) => ({ ...prev, range: value }))}
          >
            <SelectTrigger className="!h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day" className="text-xs">Today</SelectItem>
              <SelectItem value="week" className="text-xs">
                This Week
              </SelectItem>
              <SelectItem value="month" className="text-xs">
                This Month
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <CardContent className="flex flex-row items-center justify-center gap-8 w-full pb-0">
        <div className="flex-shrink-0">
          <ChartContainer
            config={chartConfig}
            style={{
              width: "250px",
              height: "200px",
            }}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel labelKey="label" />}
              />
              <Pie
                data={agentsChartData}
                dataKey="total"
                nameKey="agentId"
                innerRadius={47.5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-lg"
                          >
                            {total}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 18}
                            className="fill-muted-foreground text-[10px]"
                          >
                            Total
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
        <ul className="flex flex-col overflow-y-auto max-h-[200px] gap-4 min-w-[180px]">
          {enrichedAgents.map((agent) => (
            <li key={agent.id} className="flex items-center gap-2">
              <Link
                to={withWorkpaceLink(
                  `/agent/${agent.id}/${crypto.randomUUID()}`,
                )}
              >
                <div className="flex items-center gap-2 hover:underline">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  {agent.avatar && (
                    <img
                      src={agent.avatar}
                      alt={agent.label}
                      className="w-5 h-5 rounded-sm object-cover border border-muted"
                    />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {agent.label}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

CreditsUsedPerAgentCard.Fallback = () => (
  <Card className="w-full max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border border-slate-200">
    <div className="w-full text-sm mb-8 flex justify-between items-center">
      <span>Credits Used Per Agent</span>
    </div>
    <CardContent className="flex flex-row items-center justify-center gap-8 w-full pb-0">
      <Skeleton className="w-full h-[250px]" />
    </CardContent>
  </Card>
);

function CreditsUsedPerThread() {
  return (
    <Card className="w-full h-full flex flex-col rounded-md border border-slate-200 gap-0">
      <div className="w-full text-sm p-4 border-b border-slate-200">
        {/* TODO(@camudo): Make this a nice list grouped by thread + add to the /audit/chat view price on individual messages */}
        {/* Credits Used Per Thread */}
        Last generations
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-16 pt-3">
        <AccountStatements />
      </div>
    </Card>
  );
}

export default function BillingSettings() {
  const agents = useAgents();

  return (
    <div className="h-full text-slate-700">
      <SettingsMobileHeader currentPage="billing" />
      <div className="flex gap-4 p-4 h-[calc(100vh-64px)]">
        <div className="flex flex-col h-full min-w-0 min-w-lg gap-4">
          <BalanceCard />
          <Suspense fallback={<CreditsUsedPerAgentCard.Fallback />}>
            <CreditsUsedPerAgentCard agents={agents} />
          </Suspense>
        </div>
        <div className="flex flex-col h-full min-w-0 w-full">
          <CreditsUsedPerThread />
        </div>
      </div>
    </div>
  );
}
