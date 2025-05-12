import type { Trigger } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import cronstrue from "cronstrue";
import { format } from "date-fns";
import { useState } from "react";
import { AgentInfo, UserInfo } from "../common/TableCells.tsx";
import { DeleteTriggerModal } from "./deleteTriggerModal.tsx";

interface TriggerTableListProps {
  triggers: Trigger[];
  sortKey: "title" | "type" | "agent" | "author";
  sortDirection: "asc" | "desc";
  onSort: (key: "title" | "type" | "agent" | "author") => void;
  onTriggerClick?: (trigger: Trigger) => void;
}

function TriggersTableHeader(
  { sortKey, sortDirection, onSort }: {
    sortKey: "title" | "type" | "agent" | "author";
    sortDirection: "asc" | "desc";
    onSort: (key: "title" | "type" | "agent" | "author") => void;
  },
) {
  function renderSortIcon(key: "title" | "type" | "agent" | "author") {
    const isActive = sortKey === key;
    if (!isActive) {
      return <Icon name="arrow_upward" size={16} className="text-slate-300" />;
    }
    return (
      <Icon
        name={sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
        size={16}
        className="text-slate-700"
      />
    );
  }
  return (
    <TableHeader className="[&>*:first-child]:border-b-0">
      <TableRow className="hover:bg-transparent h-14">
        <TableHead className="px-4 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm rounded-l-full h-10">
          <button
            type="button"
            className="flex items-center gap-1 cursor-pointer select-none"
            onClick={() => onSort("title")}
          >
            Name
            {renderSortIcon("title")}
          </button>
        </TableHead>
        <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10">
          <button
            type="button"
            className="flex items-center gap-1 cursor-pointer select-none"
            onClick={() => onSort("type")}
          >
            Trigger
            {renderSortIcon("type")}
          </button>
        </TableHead>
        <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10">
          <button
            type="button"
            className="flex items-center gap-1 cursor-pointer select-none"
            onClick={() => onSort("agent")}
          >
            Agent
            {renderSortIcon("agent")}
          </button>
        </TableHead>
        <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10">
          <button
            type="button"
            className="flex items-center gap-1 cursor-pointer select-none"
            onClick={() => onSort("author")}
          >
            Created by
            {renderSortIcon("author")}
          </button>
        </TableHead>

        <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10">
          Created at
        </TableHead>
        <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm w-8 h-10 rounded-r-full">
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

function TriggerTableRow(
  { trigger, onTriggerClick }: {
    trigger: Trigger;
    onTriggerClick?: (trigger: Trigger) => void;
  },
) {
  const [open, setOpen] = useState(false);
  return (
    <TableRow className="cursor-pointer hover:bg-slate-50">
      <TableCell className="px-4" onClick={() => onTriggerClick?.(trigger)}>
        {trigger.title}
      </TableCell>
      <TableCell>
        {trigger.type === "webhook"
          ? (
            <div className="flex items-center gap-1">
              <Icon name="device_hub" size={18} />
              Webhook
            </div>
          )
          : (
            <div className="flex items-center gap-1">
              <Icon name="schedule" size={18} />
              {trigger.cronExp
                ? cronstrue.toString(trigger.cronExp)
                : trigger.cronExp}
            </div>
          )}
      </TableCell>
      <TableCell>
        <AgentInfo agentId={trigger.agent?.id} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <UserInfo userId={trigger.author?.id} />
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-[100px]">
          <div className="flex flex-col items-start text-left leading-tight">
            <span className="font-medium text-slate-800">
              {format(new Date(trigger.createdAt || ""), "MMM dd, yyyy")}
            </span>
            <span className="font-normal text-slate-500">
              {format(new Date(trigger.createdAt || ""), "HH:mm:ss")}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="more_vert" size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              className="text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DeleteTriggerModal
          trigger={trigger}
          agentId={trigger.agent?.id || ""}
          open={open}
          onOpenChange={setOpen}
        />
      </TableCell>
    </TableRow>
  );
}

export function TriggerTableList({
  triggers,
  sortKey,
  sortDirection,
  onSort,
  onTriggerClick,
}: TriggerTableListProps) {
  return (
    <Table>
      <TriggersTableHeader
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={onSort}
      />
      <TableBody className="[&>*:first-child]:border-t-0">
        {triggers.map((trigger) => (
          <TriggerTableRow
            key={trigger.id}
            trigger={trigger}
            onTriggerClick={onTriggerClick}
          />
        ))}
      </TableBody>
    </Table>
  );
}
