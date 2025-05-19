import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useCurrentTeam } from "../sidebar/TeamSelector.tsx";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@deco/ui/components/chart.tsx";
import { Label, Pie, PieChart } from "recharts";
import { DepositDialog } from "../wallet/DepositDialog.tsx";
import { getWalletAccount, getWalletStatements, useSDK } from "@deco/sdk";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@deco/ui/components/tooltip.tsx";
import { useState } from "react";

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

interface Agent {
  label: string;
  color: string;
  value: number;
  iconUrl?: string;
}

interface CreditsUsedPerAgentCardProps {
  agents: Agent[];
  total: number;
  title?: string;
}

function CreditsUsedPerAgentCard(
  { agents, total, title = "Credits Used Per Agent" }:
    CreditsUsedPerAgentCardProps,
) {
  const chartConfig = Object.fromEntries(
    agents.map((agent, idx) => [
      `agent${idx}`,
      { label: agent.label, color: agent.color },
    ]),
  ) satisfies ChartConfig;

  const agentsChartData = agents.map((agent, idx) => ({
    browser: `agent${idx}`,
    visitors: agent.value,
    fill: agent.color,
  }));

  return (
    <Card className="w-full max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border border-slate-200">
      <div className="w-full text-sm mb-8">
        {title}
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
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={agentsChartData}
                dataKey="visitors"
                nameKey="browser"
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
                            ${total}
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
        <ul className="flex flex-col gap-4 min-w-[180px]">
          {agents.map((agent, idx) => (
            <li key={agent.label} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: agent.color }}
              />
              {agent.iconUrl && (
                <img
                  src={agent.iconUrl}
                  alt={agent.label}
                  className="w-5 h-5 rounded-sm object-cover border border-muted"
                />
              )}
              <span className="text-xs text-muted-foreground">
                {agent.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CreditsUsedPerThread() {
  return (
    <Card className="w-full h-full flex flex-col rounded-md border border-slate-200 gap-0">
      <div className="w-full text-sm p-4 border-b border-slate-200">
        Credits Used Per Thread
      </div>
      <div className="flex-1 h-fit overflow-y-auto px-3 pb-16 pt-3">
        <AccountStatements />
      </div>
    </Card>
  );
}

export default function BillingSettings() {
  const agents = [
    {
      label: "Internal Rituals Agent",
      color: "#6D6DFF",
      value: 120,
      iconUrl: "https://assets.webdraw.app/uploads/capy-38.png",
    },
    {
      label: "HR Assistant",
      color: "#7ED6A2",
      value: 80,
      iconUrl: "https://assets.webdraw.app/uploads/capy-34.png",
    },
    {
      label: "Brandable",
      color: "#F48C8C",
      value: 180,
      iconUrl: "https://assets.webdraw.app/uploads/capy-37.png",
    },
    {
      label: "Research Buddy",
      color: "#B6E388",
      value: 60,
      iconUrl: "https://assets.webdraw.app/uploads/capy-36.png",
    },
    {
      label: "Onboarding Coach",
      color: "#FFD36E",
      value: 45,
      iconUrl: "https://assets.webdraw.app/uploads/capy-35.png",
    },
  ];
  const total = agents.reduce((sum, agent) => sum + agent.value, 0);

  return (
    <div className="h-full text-slate-700">
      <SettingsMobileHeader currentPage="billing" />
      <div className="flex gap-4 p-4 h-[calc(100vh-64px)]">
        <div className="flex flex-col gap-4 w-1/2 min-w-0">
          <BalanceCard />
          <CreditsUsedPerAgentCard agents={agents} total={total} />
        </div>
        <div className="w-2/3 min-w-0">
          <CreditsUsedPerThread />
        </div>
      </div>
    </div>
  );
}
