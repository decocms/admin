import type { Agent } from "@deco/sdk";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Combobox } from "@deco/ui/components/combobox.tsx";
import type { TimeRange, UsageType } from "./usage.tsx";

export function UsageFilters({
  usageType,
  setUsageType,
  selectedAgent,
  setSelectedAgent,
  timeRange,
  setTimeRange,
  agents,
}: {
  usageType: UsageType;
  setUsageType: (value: UsageType) => void;
  selectedAgent: string;
  setSelectedAgent: (value: string) => void;
  timeRange: TimeRange;
  setTimeRange: (value: TimeRange) => void;
  agents: Agent[];
}) {
  return (
    <div className="flex justify-between items-center w-full">
      <div className="flex items-center gap-2">
        <Select value={usageType} onValueChange={setUsageType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Usage by agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agent">Usage by agent</SelectItem>
            <SelectItem value="user">Usage by user</SelectItem>
            <SelectItem value="thread">Usage by thread</SelectItem>
          </SelectContent>
        </Select>

        <Combobox
          options={[
            { value: "all", label: "All agents" },
            ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
          ]}
          value={selectedAgent}
          onChange={(value) => {
            setSelectedAgent(value);
          }}
        />
      </div>

      <Select value={timeRange} onValueChange={setTimeRange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Last 7 days" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Last 24 hours</SelectItem>
          <SelectItem value="week">Last 7 days</SelectItem>
          <SelectItem value="month">Last 30 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
