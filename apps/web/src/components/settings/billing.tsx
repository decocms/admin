import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useCurrentTeam } from "../sidebar/TeamSelector.tsx";
import { Link, useParams } from "react-router";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@deco/ui/components/chart.tsx";
import { Label, Pie, PieChart } from "recharts";
import { DepositDialog } from "../wallet/DepositDialog.tsx";
import {
  getAgentsUsage,
  getThreadsUsage,
  getWalletAccount,
  type Member,
  useAgents,
  useSDK,
  useTeamMembersBySlug,
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
import { Suspense, useMemo, useState } from "react";
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

function BalanceCard() {
  const team = useCurrentTeam();

  return (
    <Card className="w-full md:max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border border-slate-200">
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
  const [range, setRange] = useState<"day" | "week" | "month">("month");
  const [top5Only, setTop5Only] = useState(false);
  const { data: usage } = useSuspenseQuery({
    queryKey: [
      "wallet-usage",
      workspace,
      range,
    ],
    queryFn: () => getAgentsUsage(workspace, range),
  });
  const withWorkpaceLink = useWorkspaceLink();

  const total = usage.total;
  const enrichedAgents = usage.items.map((_agent) => {
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
    <Card className="w-full md:max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border border-slate-200">
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
            value={range}
            onValueChange={(value: "day" | "week" | "month") => setRange(value)}
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

function CreditsUsedPerThread({
  agents: workspaceAgents,
  teamMembers,
}: {
  agents: ReturnType<typeof useAgents>;
  teamMembers: Member[];
}) {
  const { workspace } = useSDK();
  const withWorkpaceLink = useWorkspaceLink();
  const [range, setRange] = useState<"day" | "week" | "month">("month");
  const { data: threads } = useSuspenseQuery({
    queryKey: ["threads-usage", workspace, range],
    queryFn: () => getThreadsUsage(workspace, range),
  });

  const enrichedThreads = threads.items.map((thread) => {
    const agent = workspaceAgents.data?.find((a) => a.id === thread.agentId);
    const member = teamMembers.find((m) => m.user_id === thread.generatedBy);
    return {
      agent,
      member,
      ...thread,
    };
  });

  return (
    <Card className="w-full h-full flex flex-col rounded-md border border-slate-200 gap-0">
      <div className="w-full text-sm p-4 border-b border-slate-200 flex justify-between items-center">
        <span>Credits Used Per Thread</span>

        <Select
          value={range}
          onValueChange={(value: "day" | "week" | "month") => setRange(value)}
        >
          <SelectTrigger className="!h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day" className="text-xs">Today</SelectItem>
            <SelectItem value="week" className="text-xs">This Week</SelectItem>
            <SelectItem value="month" className="text-xs">
              This Month
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-16 pt-3">
        {enrichedThreads.map((thread) => (
          <Dialog>
            <DialogTrigger asChild>
              <div className="flex items-center justify-between p-4 mb-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  {thread.agent?.avatar
                    ? (
                      <img
                        src={thread.agent.avatar}
                        alt={thread.agent.name || "Agent"}
                        className="w-10 h-10 rounded-sm object-cover border border-muted"
                      />
                    )
                    : (
                      <div className="w-10 h-10 rounded-sm flex items-center justify-center bg-gray-50 border border-muted">
                        <Icon
                          name="robot_2"
                          size={24}
                          className="text-gray-400"
                        />
                      </div>
                    )}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-900">
                      {thread.agent?.name || "Unknown Agent"}
                    </span>
                    <div className="flex items-center gap-2">
                      {thread.member?.profiles?.metadata?.avatar_url
                        ? (
                          <img
                            src={thread.member.profiles.metadata.avatar_url}
                            alt={thread.member.profiles.metadata?.full_name ||
                              "User"}
                            className="w-4 h-4 rounded-md object-cover"
                          />
                        )
                        : (
                          <div className="w-4 h-4 rounded-md flex items-center justify-center bg-gray-50">
                            <Icon
                              name="user"
                              size={12}
                              className="text-gray-400"
                            />
                          </div>
                        )}
                      <span className="text-xs text-slate-500">
                        {thread.member?.profiles?.metadata?.full_name ||
                          "Unknown User"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    {thread.total}
                  </span>
                </div>
              </div>
            </DialogTrigger>
            <ThreadDetails
              thread={thread}
              withWorkpaceLink={withWorkpaceLink}
            />
          </Dialog>
        ))}
      </div>
    </Card>
  );
}

interface ThreadDetailsProps {
  thread: {
    agent?: any;
    member?: Member;
    id: string;
    total: string;
    [key: string]: any;
  };
  withWorkpaceLink: (path: string) => string;
}

function ThreadDetails({ thread, withWorkpaceLink }: ThreadDetailsProps) {
  return (
    <DialogContent className="sm:max-w-[400px] p-6">
      <DialogHeader>
        <DialogTitle>Thread Details</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-6">
        {/* Agent Section */}
        <div className="flex items-center gap-4">
          {thread.agent?.avatar
            ? (
              <img
                src={thread.agent.avatar}
                alt={thread.agent.name || "Agent"}
                className="w-12 h-12 rounded-sm object-cover border border-muted"
              />
            )
            : (
              <div className="w-12 h-12 rounded-sm flex items-center justify-center bg-gray-50 border border-muted">
                <Icon name="robot_2" size={28} className="text-gray-400" />
              </div>
            )}
          <div className="flex flex-col justify-center">
            <span className="text-base font-semibold text-gray-900">
              {thread.agent?.name || "Unknown Agent"}
            </span>
            <span className="text-sm text-muted-foreground mt-1">
              {thread.total} credits used
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* User Section */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground mb-1">
            User
          </span>
          <div className="flex items-center gap-3">
            {thread.member?.profiles?.metadata?.avatar_url
              ? (
                <img
                  src={thread.member.profiles.metadata.avatar_url}
                  alt={thread.member.profiles.metadata?.full_name || "User"}
                  className="w-8 h-8 rounded-md object-cover"
                />
              )
              : (
                <div className="w-8 h-8 rounded-md flex items-center justify-center bg-gray-50">
                  <Icon name="user" size={16} className="text-gray-400" />
                </div>
              )}
            <span className="text-sm text-gray-900">
              {thread.member?.profiles?.metadata?.full_name || "Unknown User"}
            </span>
          </div>
        </div>

        {/* View messages button */}
        <Button
          variant="outline"
          size="sm"
          asChild
          className="mt-2 w-full justify-center"
        >
          <Link
            to={withWorkpaceLink(`/audit/${thread.id}`)}
          >
            <Icon name="open_in_new" size={16} />
            View messages
          </Link>
        </Button>
      </div>
    </DialogContent>
  );
}

export default function BillingSettings() {
  const agents = useAgents();
  const { teamSlug } = useParams();
  const { data: _members } = useTeamMembersBySlug(teamSlug ?? null);

  const members = useMemo(() => {
    return _members?.length ? _members : [];
  }, [_members]);

  return (
    <div className="h-full text-slate-700">
      <SettingsMobileHeader currentPage="billing" />
      <div className="flex flex-col md:flex-row gap-4 p-4 h-full md:h-[calc(100vh-64px)] overflow-y-auto">
        <div className="flex flex-col h-full min-w-0 min-w-lg gap-4">
          <BalanceCard />
          <Suspense fallback={<CreditsUsedPerAgentCard.Fallback />}>
            <CreditsUsedPerAgentCard agents={agents} />
          </Suspense>
        </div>
        <div className="flex flex-col h-full min-w-0 w-full">
          <CreditsUsedPerThread
            agents={agents}
            teamMembers={members}
          />
        </div>
      </div>
    </div>
  );
}
