import type { Trigger } from "@deco/sdk";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@deco/ui/components/avatar.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { DeleteTriggerModal } from "./deleteTriggerModal.tsx";
import { timeAgo } from "../../utils/timeAgo.ts";
import cronstrue from "cronstrue";

interface TriggerTableListProps {
  triggers: Trigger[];
  sortKey: "title" | "type" | "agent" | "author";
  sortDirection: "asc" | "desc";
  onSort: (key: "title" | "type" | "agent" | "author") => void;
  onTriggerClick?: (trigger: Trigger) => void;
  className?: string;
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
        <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm rounded-r-full w-8 h-10">
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
      <TableCell
        onClick={() => onTriggerClick?.(trigger)}
        className="px-4"
      >
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
        <a
          href={trigger.agent?.id
            ? `/agent/${trigger.agent.id}/${trigger.agent.id}`
            : "#"}
          className="flex items-center gap-2 group hover:underline focus-visible:underline outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar className="size-6 rounded-sm">
            {trigger.agent?.avatar
              ? (
                <AvatarImage
                  src={trigger.agent.avatar}
                  alt={trigger.agent.name}
                />
              )
              : (
                <AvatarFallback className="rounded-xl bg-[#E3E0FF]">
                  {trigger.agent?.name?.[0] || "A"}
                </AvatarFallback>
              )}
          </Avatar>
          <span className="font-mediu ml-2 align-middle group-hover:underline group-focus-visible:underline">
            {trigger.agent?.name}
          </span>
        </a>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            {trigger.author?.avatar
              ? (
                <AvatarImage
                  src={trigger.author.avatar}
                  alt={trigger.author.name}
                />
              )
              : (
                <AvatarFallback>
                  {trigger.author?.name?.[0] || "U"}
                </AvatarFallback>
              )}
          </Avatar>
          <span className="font-mediu ml-2 align-middle">
            {trigger.author?.name}
          </span>
          {trigger.createdAt && (
            <span className="text-xs text-slate-400 ml-1">
              {timeAgo(trigger.createdAt)}
            </span>
          )}
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
  className,
}: TriggerTableListProps) {
  return (
    <div className={className}>
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
    </div>
  );
}
