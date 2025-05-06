import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { format } from "date-fns";
import { AgentInfo, UserInfo } from "../common/TableCells.tsx";

interface AuditTableProps {
  threads: Array<{
    id: string;
    resourceId: string;
    title: string;
    metadata: { agentId: string };
    createdAt: string;
    updatedAt: string;
  }>;
  sort: string;
  onSortChange: (sort: string) => void;
  onRowClick?: (threadId: string) => void;
}

export function AuditTable(
  { threads, sort, onSortChange, onRowClick }: AuditTableProps,
) {
  return (
    <Table>
      <TableHeader className="[&>*:first-child]:border-b-0 mb-2">
        <TableRow className="hover:bg-transparent h-14">
          <TableHead className="px-4 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10 rounded-l-full">
            <button
              type="button"
              className="flex items-center gap-1 cursor-pointer select-none"
              onClick={() =>
                onSortChange(
                  sort === "updatedAt_desc"
                    ? "updatedAt_asc"
                    : "updatedAt_desc",
                )}
            >
              Last updated
              <Icon
                name="arrow_upward"
                size={16}
                className={cn(
                  "transition-transform",
                  sort.startsWith("updatedAt")
                    ? "text-slate-700"
                    : "text-slate-300",
                )}
                style={{
                  transform: sort === "updatedAt_asc"
                    ? "rotate(180deg)"
                    : undefined,
                }}
              />
            </button>
          </TableHead>
          <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10">
            <button
              type="button"
              className="flex items-center gap-1 cursor-pointer select-none"
              onClick={() => onSortChange(
                sort === "createdAt_desc" ? "createdAt_asc" : "createdAt_desc",
              )}
            >
              Created at
              <Icon
                name="arrow_upward"
                size={16}
                className={cn(
                  "transition-transform",
                  sort.startsWith("createdAt")
                    ? "text-slate-700"
                    : "text-slate-300",
                )}
                style={{
                  transform: sort === "createdAt_asc"
                    ? "rotate(180deg)"
                    : undefined,
                }}
              />
            </button>
          </TableHead>
          <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10">
            Agent
          </TableHead>
          <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10">
            Used by
          </TableHead>
          <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10 rounded-r-full">
            Thread name
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="[&>*:first-child]:border-t-0">
        {threads.map((thread) => (
          <TableRow
            key={thread.id}
            className="cursor-pointer hover:bg-accent/40 transition-colors"
            onClick={() => onRowClick?.(thread.id)}
          >
            <TableCell>
              <div className="max-w-[100px]">
                <div className="flex flex-col items-start text-left leading-tight">
                  <span className="font-medium text-slate-800">
                    {format(new Date(thread.updatedAt), "MMM dd, yyyy")}
                  </span>
                  <span className="font-normal text-slate-500">
                    {format(new Date(thread.updatedAt), "HH:mm:ss")}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="max-w-[100px]">
                <div className="flex flex-col items-start text-left leading-tight">
                  <span className="font-medium text-slate-800">
                    {format(new Date(thread.createdAt), "MMM dd, yyyy")}
                  </span>
                  <span className="font-normal text-slate-500">
                    {format(new Date(thread.createdAt), "HH:mm:ss")}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell className="max-w-[125px]">
              <AgentInfo agentId={thread.metadata.agentId} />
            </TableCell>
            <TableCell className="max-w-[125px]">
              <UserInfo userId={thread.resourceId} />
            </TableCell>
            <TableCell className="max-w-xs truncate">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate block">{thread.title}</span>
                </TooltipTrigger>
                <TooltipContent className="whitespace-pre-line break-words max-w-xs">
                  {thread.title}
                </TooltipContent>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
