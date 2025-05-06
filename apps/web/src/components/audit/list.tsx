import { useAgents, useAuditEvents, useTeamMembers, useTeams } from "@deco/sdk";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@deco/ui/components/pagination.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { format } from "date-fns";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useNavigateWorkspace } from "../../hooks/useNavigateWorkspace.ts";
import { AgentInfo, UserInfo } from "../common/TableCells.tsx";

type AuditOrderBy =
  | "createdAt_desc"
  | "createdAt_asc"
  | "updatedAt_desc"
  | "updatedAt_asc";

const SORT_OPTIONS: { value: AuditOrderBy; label: string }[] = [
  { value: "createdAt_desc", label: "Newest" },
  { value: "createdAt_asc", label: "Oldest" },
  { value: "updatedAt_desc", label: "Recently Updated" },
  { value: "updatedAt_asc", label: "Least Recently Updated" },
];

const limit = 11;

function AuditListErrorFallback() {
  return (
    <Alert variant="destructive" className="my-8">
      <AlertTitle>Error loading audit events</AlertTitle>
      <AlertDescription>
        Something went wrong while loading the audit events.
      </AlertDescription>
    </Alert>
  );
}

function AuditListContent() {
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>(
    undefined,
  );
  const [selectedUser, setSelectedUser] = useState<string | undefined>(
    undefined,
  );
  const [sort, setSort] = useState<AuditOrderBy>(SORT_OPTIONS[0].value);
  // Cursor-based pagination state
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(
    undefined,
  );
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const navigate = useNavigateWorkspace();

  // Fetch agents for filter dropdown
  const { data: agents } = useAgents();

  // Get teamId from teams and params
  const params = useParams();
  const { data: teams } = useTeams();
  const resolvedTeamSlug = params.teamSlug;
  const teamId = teams?.find((t) => t.slug === resolvedTeamSlug)?.id ?? null;
  const members = teamId !== null ? useTeamMembers(teamId).data : [];

  // Sort members by name (or fallback to email or user_id)
  const sortedMembers = [...(members ?? [])].sort((a, b) => {
    const nameA = a.profiles?.metadata?.full_name || a.profiles?.email ||
      a.user_id;
    const nameB = b.profiles?.metadata?.full_name || b.profiles?.email ||
      b.user_id;
    return nameA.localeCompare(nameB);
  });

  // Fetch audit events
  const { data: auditData } = useAuditEvents({
    agentId: selectedAgent,
    resourceId: selectedUser,
    orderBy: sort,
    cursor: currentCursor,
    limit,
  });

  // Pagination logic
  const threads = auditData?.threads ?? [];
  const pagination = auditData?.pagination;

  // Handlers
  function handleAgentChange(value: string) {
    setSelectedAgent(value === "all" ? undefined : value);
    setCurrentCursor(undefined);
    setPrevCursors([]);
  }
  function handleUserChange(value: string) {
    setSelectedUser(value === "all" ? undefined : value);
    setCurrentCursor(undefined);
    setPrevCursors([]);
  }
  function handleNextPage() {
    if (pagination?.hasMore && pagination?.nextCursor) {
      setPrevCursors((prev) => [...prev, currentCursor ?? ""]);
      setCurrentCursor(pagination.nextCursor);
    }
  }
  function handlePrevPage() {
    if (prevCursors.length > 0) {
      const newPrevCursors = [...prevCursors];
      const prevCursor = newPrevCursors.pop();
      setPrevCursors(newPrevCursors);
      setCurrentCursor(
        prevCursor && prevCursor.length > 0 ? prevCursor : undefined,
      );
    }
  }

  // Table columns: Updated, Created, Agent, Resource, Thread name
  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-2 min-w-[180px]">
          <Label htmlFor="agent-select">Agent</Label>
          <Select
            value={selectedAgent ?? "all"}
            onValueChange={handleAgentChange}
          >
            <SelectTrigger id="agent-select" className="w-full">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {sortedMembers.length > 0 && (
          <div className="flex flex-col gap-2 min-w-[180px]">
            <Label htmlFor="user-select">Used by</Label>
            <Select
              value={selectedUser ?? "all"}
              onValueChange={handleUserChange}
            >
              <SelectTrigger id="user-select" className="w-full">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {sortedMembers.map((member) => {
                  const name = member.profiles?.metadata?.full_name ||
                    member.profiles?.email || member.user_id;
                  const email = member.profiles?.email;
                  return (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <span>
                        {name}
                        {email && email !== name && (
                          <span className="ml-2 text-xs text-slate-400">
                            {email}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {/* Empty state */}
      {!threads.length
        ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <span className="text-lg font-medium">No audit events found</span>
          </div>
        )
        : (
          <>
            {/* Table */}
            <Table>
              <TableHeader className="[&>*:first-child]:border-b-0 mb-2">
                <TableRow className="hover:bg-transparent h-14">
                  <TableHead className="px-4 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10 rounded-l-full">
                    <button
                      type="button"
                      className="flex items-center gap-1 cursor-pointer select-none"
                      onClick={() => {
                        setSort((prev) =>
                          prev === "updatedAt_desc"
                            ? "updatedAt_asc"
                            : "updatedAt_desc"
                        );
                        setCurrentCursor(undefined);
                        setPrevCursors([]);
                      }}
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
                      onClick={() => {
                        setSort((prev) =>
                          prev === "createdAt_desc"
                            ? "createdAt_asc"
                            : "createdAt_desc"
                        );
                        setCurrentCursor(undefined);
                        setPrevCursors([]);
                      }}
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
                {threads.map((thread) => {
                  return (
                    <TableRow
                      key={thread.id}
                      className="cursor-pointer hover:bg-accent/40 transition-colors"
                      onClick={() => {
                        navigate(`/audit/${thread.id}`);
                      }}
                    >
                      <TableCell>
                        <div className="max-w-[100px]">
                          <div className="flex flex-col items-start text-left leading-tight">
                            <span className="font-medium text-slate-800">
                              {format(
                                new Date(thread.updatedAt),
                                "MMM dd, yyyy",
                              )}
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
                              {format(
                                new Date(thread.createdAt),
                                "MMM dd, yyyy",
                              )}
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
                            <span className="truncate block">
                              {thread.title}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="whitespace-pre-line break-words max-w-xs">
                            {thread.title}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {/* Pagination */}
            <div className="flex justify-center mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (prevCursors.length > 0) handlePrevPage();
                      }}
                      aria-disabled={prevCursors.length === 0}
                      tabIndex={prevCursors.length === 0 ? -1 : 0}
                      className={prevCursors.length === 0
                        ? "opacity-50 pointer-events-none"
                        : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-3 py-1 text-sm text-muted-foreground select-none">
                      Page {prevCursors.length + 1}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (pagination?.hasMore) handleNextPage();
                      }}
                      aria-disabled={!pagination?.hasMore}
                      tabIndex={!pagination?.hasMore ? -1 : 0}
                      className={!pagination?.hasMore
                        ? "opacity-50 pointer-events-none"
                        : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
    </div>
  );
}

function AuditList() {
  return (
    <div className="flex flex-col gap-6 w-full px-6 py-10 h-full">
      <div className="text-slate-700 text-2xl">
        Chat logs
      </div>
      <ErrorBoundary fallback={<AuditListErrorFallback />}>
        <Suspense
          fallback={
            <div className="flex justify-center items-center h-64">
              <Spinner />
            </div>
          }
        >
          <AuditListContent />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default AuditList;
