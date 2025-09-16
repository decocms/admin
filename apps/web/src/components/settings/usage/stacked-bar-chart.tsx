import type { Member } from "@deco/sdk";
import { Card } from "@deco/ui/components/card.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useState } from "react";
import { AgentAvatar } from "../../common/avatar/agent.tsx";
import { UserAvatar } from "../../common/avatar/user.tsx";

export interface ChartBarStackItem {
  id: string;
  name: string;
  avatar?: string;
  cost: number;
  color: string;
  type: string;
  member?: Member | null;
}

export interface ChartBarStack {
  label: string;
  items: ChartBarStackItem[];
  total: number;
}

interface EnrichedChartBarStackItem extends ChartBarStackItem {
  percentage: number;
}

interface EnrichedChartBarStack extends ChartBarStack {
  items: EnrichedChartBarStackItem[];
}

function YAxisLabels({ chartMax }: { chartMax: number }) {
  const yAxisLabels = [];
  const step = chartMax / 5;
  for (let i = chartMax; i >= 0; i -= step) {
    yAxisLabels.push(Math.round(i * 100) / 100);
  }

  return (
    <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between">
      {yAxisLabels.map((value) => (
        <div
          key={value}
          className="text-right text-xs text-foreground pr-2 flex items-center justify-end h-0"
        >
          ${value}
        </div>
      ))}
    </div>
  );
}

function GridLines({ chartMax }: { chartMax: number }) {
  const yAxisLabels = [];
  const step = chartMax / 5;
  for (let i = chartMax; i >= 0; i -= step) {
    yAxisLabels.push(Math.round(i * 100) / 100);
  }

  return (
    <div className="absolute left-10 right-0 top-0 bottom-6 flex flex-col justify-between">
      {yAxisLabels.map((value) => (
        <div key={value} className="w-full border-t border-border/30 h-0" />
      ))}
    </div>
  );
}

function ChartColumn({
  day,
  index,
  chartData,
  chartMax,
  hoveredColumn,
  setHoveredColumn,
}: {
  day: EnrichedChartBarStack;
  index: number;
  chartData: EnrichedChartBarStack[];
  chartMax: number;
  hoveredColumn: number | null;
  setHoveredColumn: (index: number | null) => void;
}) {
  const columnWidth = chartData.length > 12
    ? "50px"
    : chartData.length <= 7
    ? "100px"
    : "80px";
  const minWidth = chartData.length > 12 ? "40px" : "60px";

  return (
    <Tooltip delayDuration={0} disableHoverableContent>
      <TooltipTrigger asChild>
        <div
          className={`flex flex-col items-center cursor-pointer transition-opacity duration-200 ${
            hoveredColumn !== null && hoveredColumn !== index
              ? "opacity-30"
              : "opacity-100"
          }`}
          style={{
            width: columnWidth,
            minWidth,
            height: "100%",
          }}
          onMouseEnter={() => setHoveredColumn(index)}
          onMouseLeave={() => setHoveredColumn(null)}
        >
          <div className="w-full flex flex-col justify-end gap-0.5 h-full">
            {day.items.map(
              (item: EnrichedChartBarStackItem, itemIndex: number) => (
                <div
                  key={`${item.id}-${itemIndex}`}
                  className="w-full rounded-md min-h-[4px]"
                  style={{
                    backgroundColor: item.color,
                    height: `${Math.max(4, (item.cost / chartMax) * 100)}%`,
                  }}
                />
              ),
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side={index >= chartData.length / 2 ? "left" : "right"}
        sideOffset={10}
        className="bg-background text-foreground shadow-lg pointer-events-none [&_[class*='bg-primary']]:!bg-background [&_[class*='fill-primary']]:!fill-background"
      >
        <div className="space-y-2">
          <div className="text-sm font-medium">{day.label}</div>
          <div className="space-y-1">
            {day.items.map(
              (item: EnrichedChartBarStackItem, itemIndex: number) => (
                <div
                  key={itemIndex}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-2 h-2 rounded flex-shrink-0"
                      style={{
                        backgroundColor: item.id === "other"
                          ? "#E5E7EB"
                          : item.color,
                      }}
                    />
                    {item.id !== "other" && (
                      <>
                        {item.type === "user" && item.member
                          ? (
                            <UserAvatar
                              url={item.member.profiles?.metadata?.avatar_url}
                              fallback={item.member.profiles?.email ||
                                "Unknown"}
                              size="sm"
                            />
                          )
                          : (
                            <AgentAvatar
                              url={item.avatar}
                              fallback={item.name}
                              size="sm"
                            />
                          )}
                      </>
                    )}
                    <span className="text-xs truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      ${item.cost.toFixed(2)}
                    </span>
                    <span className="text-xs font-medium">
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function XAxisLabels({ chartData }: { chartData: EnrichedChartBarStack[] }) {
  const columnWidth = chartData.length > 12
    ? "50px"
    : chartData.length <= 7
    ? "100px"
    : "80px";
  const minWidth = chartData.length > 12 ? "40px" : "60px";

  return (
    <div className="absolute left-10 right-0 bottom-0 px-8 flex justify-between pt-1 h-6">
      {chartData.map((day: EnrichedChartBarStack, index: number) => (
        <div
          key={`label-${index}`}
          className="text-xs text-center text-foreground px-1"
          style={{
            width: columnWidth,
            minWidth,
          }}
        >
          <div
            className="whitespace-nowrap overflow-hidden text-ellipsis"
            title={day.label}
          >
            {day.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function withDistributedPercentage(
  data: ChartBarStackItem[],
): EnrichedChartBarStackItem[] {
  const total = data.reduce((sum, item) => sum + item.cost, 0);
  return data.map((item) => ({
    ...item,
    percentage: (item.cost / total) * 100,
  }));
}

export function StackedBarChart({
  chartData: _data,
}: {
  chartData: ChartBarStack[];
}) {
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

  const chartData = _data.map((day) => ({
    ...day,
    items: withDistributedPercentage(day.items),
  }));

  const maxValue = Math.max(
    ...chartData.map((d: EnrichedChartBarStack) => d.total),
  );
  const chartMax = maxValue > 0
    ? Math.max(0.1, Math.ceil(maxValue * 1.1 * 100) / 100)
    : 0.1;

  return (
    <Card className="w-full p-6 rounded-xl border bg-muted/50">
      <div className="relative h-96">
        <YAxisLabels chartMax={chartMax} />
        <GridLines chartMax={chartMax} />

        <div className="absolute left-10 right-0 top-0 bottom-6 px-8 flex items-end justify-between">
          {chartData.map((day: EnrichedChartBarStack, index: number) => (
            <ChartColumn
              key={index}
              day={day}
              index={index}
              chartData={chartData}
              chartMax={chartMax}
              hoveredColumn={hoveredColumn}
              setHoveredColumn={setHoveredColumn}
            />
          ))}
        </div>

        <XAxisLabels chartData={chartData} />
      </div>
    </Card>
  );
}
