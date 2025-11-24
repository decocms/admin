import type { ThreadFilterOptions } from "@deco/sdk";
import {
  useAgents,
  useAuditEvents,
  useOrganizations,
  useTeamMembersBySlug,
} from "@deco/sdk";
import { WELL_KNOWN_AGENTS } from "@deco/sdk/constants";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
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
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useThread, buildThreadUri } from "../decopilot/thread-provider.tsx";
import { AuditFilters } from "./audit-filters.tsx";
import { AuditTable } from "./audit-table.tsx";

const CURSOR_PAGINATION_SEARCH_PARAM = "after";
const AGENT_FILTER_SEARCH_PARAM = "agent";
const USER_FILTER_SEARCH_PARAM = "user";
const THREAD_FILTER_SEARCH_PARAM = "thread";
const SORT_SEARCH_PARAM = "sort";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_SEARCH_PARAM = "pageSize";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const SORT_OPTIONS = [
  { value: "createdAt_desc", label: "Newest" },
  { value: "createdAt_asc", label: "Oldest" },
  { value: "updatedAt_desc", label: "Recently Updated" },
  { value: "updatedAt_asc", label: "Least Recently Updated" },
] satisfies Array<{ value: ThreadFilterOptions["orderBy"]; label: string }>;

type AuditOrderBy = (typeof SORT_OPTIONS)[number]["value"];

interface AuditListContentProps {
  showFilters?: boolean;
  columnsDenyList?: Set<string>;
  filters?: Partial<ThreadFilterOptions>;
}

export function AuditListContent({
  showFilters = true,
  columnsDenyList,
  filters,
}: AuditListContentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>(
    filters?.agentId ??
      searchParams.get(AGENT_FILTER_SEARCH_PARAM) ??
      undefined,
  );
  const [selectedUser, setSelectedUser] = useState<string | undefined>(
    filters?.resourceId ??
      searchParams.get(USER_FILTER_SEARCH_PARAM) ??
      undefined,
  );
  const [selectedThreadFilter, setSelectedThreadFilter] = useState<
    string | undefined
  >(searchParams.get(THREAD_FILTER_SEARCH_PARAM) ?? undefined);
  const [pageSize, setPageSize] = useState<number>(() => {
    const fromFilter = filters?.limit;
    if (
      typeof fromFilter === "number" &&
      PAGE_SIZE_OPTIONS.includes(fromFilter)
    ) {
      return fromFilter;
    }

    const fromSearchParams = searchParams.get(PAGE_SIZE_SEARCH_PARAM);
    const parsed = fromSearchParams
      ? Number.parseInt(fromSearchParams, 10)
      : null;
    if (parsed && PAGE_SIZE_OPTIONS.includes(parsed)) {
      return parsed;
    }

    return DEFAULT_PAGE_SIZE;
  });
  const [sort, setSort] = useState<AuditOrderBy>(
    (() => {
      const sortParam = searchParams.get(SORT_SEARCH_PARAM);
      const isValid = SORT_OPTIONS.some((o) => o.value === sortParam);
      return (
        filters?.orderBy ??
        (isValid ? (sortParam as AuditOrderBy) : undefined) ??
        SORT_OPTIONS[0].value
      );
    })(),
  );

  // Re-sync state when URL params change (e.g., browser back/forward)
  useEffect(() => {
    if (!filters?.agentId) {
      const agentParam = searchParams.get(AGENT_FILTER_SEARCH_PARAM);
      setSelectedAgent(agentParam ?? undefined);
    }
  }, [searchParams, filters?.agentId]);

  useEffect(() => {
    if (!filters?.resourceId) {
      const userParam = searchParams.get(USER_FILTER_SEARCH_PARAM);
      setSelectedUser(userParam ?? undefined);
    }
  }, [searchParams, filters?.resourceId]);

  useEffect(() => {
    if (!filters?.limit) {
      const pageSizeParam = searchParams.get(PAGE_SIZE_SEARCH_PARAM);
      const parsed = pageSizeParam ? Number.parseInt(pageSizeParam, 10) : null;
      if (parsed && PAGE_SIZE_OPTIONS.includes(parsed)) {
        setPageSize(parsed);
      }
    }
  }, [searchParams, filters?.limit]);

  useEffect(() => {
    if (!filters?.orderBy) {
      const sortParam = searchParams.get(SORT_SEARCH_PARAM);
      const isValid = SORT_OPTIONS.some((o) => o.value === sortParam);
      if (isValid) {
        setSort(sortParam as AuditOrderBy);
      }
    }
  }, [searchParams, filters?.orderBy]);

  useEffect(() => {
    const threadParam = searchParams.get(THREAD_FILTER_SEARCH_PARAM);
    setSelectedThreadFilter(threadParam ?? undefined);
  }, [searchParams]);

  const { addTab } = useThread();

  const { data: customAgents = [] } = useAgents();
  // Include well-known agents like Decopilot
  const agents = useMemo(
    () => [...customAgents, ...Object.values(WELL_KNOWN_AGENTS)],
    [customAgents],
  );
  const params = useParams();
  const getSafeCursor = (cursor: string | null) => {
    if (!cursor) return;
    try {
      new Date(cursor);
      return cursor;
    } catch {
      return;
    }
  };
  const currentCursor =
    getSafeCursor(searchParams.get(CURSOR_PAGINATION_SEARCH_PARAM)) ??
    undefined;
  const resolvedOrgSlug = params.org ?? "";
  const { data: teams = [] } = useOrganizations();
  const resolvedSlug =
    teams.find((team) => team.slug === resolvedOrgSlug)?.slug ?? null;
  const { data: teamMembersData } = useTeamMembersBySlug(resolvedSlug);
  const members = teamMembersData?.members ?? [];

  // Memoize audit options to prevent unnecessary refetches
  const auditOptions = useMemo(
    () => ({
      agentId: filters?.agentId ?? selectedAgent,
      resourceId:
        filters?.resourceId ??
        (selectedUser === "unknown" ? "__unknown__" : selectedUser),
      threadId: selectedThreadFilter,
      orderBy: filters?.orderBy ?? sort,
      cursor: filters?.cursor ?? currentCursor,
      limit: filters?.limit ?? pageSize,
    }),
    [
      filters?.agentId,
      filters?.resourceId,
      filters?.orderBy,
      filters?.cursor,
      filters?.limit,
      selectedAgent,
      selectedUser,
      selectedThreadFilter,
      sort,
      currentCursor,
      pageSize,
    ],
  );

  const { data: auditData, isLoading, error } = useAuditEvents(auditOptions);

  const threads = auditData?.threads ?? [];
  const pagination = auditData?.pagination;

  const rowsPerPageControl = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
      <span className="whitespace-nowrap">Rows per page</span>
      <Select
        value={String(pageSize)}
        onValueChange={(value) =>
          handlePageSizeChange(Number.parseInt(value, 10))
        }
      >
        <SelectTrigger className="w-[96px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // When a thread is selected via URL filter, open it in a new tab
  useEffect(() => {
    if (!selectedThreadFilter || threads.length === 0) {
      return;
    }

    const filteredThread = threads.find(
      (thread) => thread.id === selectedThreadFilter,
    );

    if (filteredThread) {
      const resourceUri = buildThreadUri(filteredThread.id);
      addTab({
        type: "detail",
        resourceUri,
        title: filteredThread.title || "Thread",
      });
    }
  }, [selectedThreadFilter, threads, addTab]);

  function handlePageSizeChange(value: number) {
    setPageSize(value);

    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set(PAGE_SIZE_SEARCH_PARAM, String(value));
    newSearchParams.delete(CURSOR_PAGINATION_SEARCH_PARAM);
    setSearchParams(newSearchParams);
  }

  function handleThreadSelect(threadId: string) {
    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
      const resourceUri = buildThreadUri(thread.id);
      addTab({
        type: "detail",
        resourceUri,
        title: thread.title || "Thread",
      });
    }
  }

  function handleAgentChange(value: string) {
    const newAgentValue = value === "all" ? undefined : value;
    setSelectedAgent(newAgentValue);

    const newSearchParams = new URLSearchParams(searchParams);
    if (newAgentValue) {
      newSearchParams.set(AGENT_FILTER_SEARCH_PARAM, newAgentValue);
    } else {
      newSearchParams.delete(AGENT_FILTER_SEARCH_PARAM);
    }
    newSearchParams.delete(CURSOR_PAGINATION_SEARCH_PARAM);
    setSearchParams(newSearchParams);
  }

  function handleUserChange(value: string) {
    const newUserValue = value === "all" ? undefined : value;
    setSelectedUser(newUserValue);

    const newSearchParams = new URLSearchParams(searchParams);
    if (newUserValue) {
      newSearchParams.set(USER_FILTER_SEARCH_PARAM, newUserValue);
    } else {
      newSearchParams.delete(USER_FILTER_SEARCH_PARAM);
    }
    newSearchParams.delete(CURSOR_PAGINATION_SEARCH_PARAM);
    setSearchParams(newSearchParams);
  }

  function handleSortChange(newSort: string) {
    setSort(newSort as AuditOrderBy);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set(SORT_SEARCH_PARAM, newSort);
    newSearchParams.delete(CURSOR_PAGINATION_SEARCH_PARAM);
    setSearchParams(newSearchParams);
  }

  function handleNextPage() {
    if (pagination?.hasMore && pagination?.nextCursor) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set(
        CURSOR_PAGINATION_SEARCH_PARAM,
        pagination.nextCursor,
      );
      setSearchParams(newSearchParams);
    }
  }

  function handlePrevPage() {
    if (pagination?.prevCursor) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set(
        CURSOR_PAGINATION_SEARCH_PARAM,
        pagination.prevCursor,
      );
      setSearchParams(newSearchParams);
    }
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <Alert variant="destructive" className="max-w-xl">
          <AlertTitle>Error loading activity</AlertTitle>
          <AlertDescription>
            Something went wrong while loading the activity data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col max-w-[1500px] mx-auto">
      <div className="flex h-full min-w-0 flex-col bg-background">
        <div className="flex flex-wrap items-end gap-2 px-2 pt-2 pb-2">
          {showFilters ? (
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <AuditFilters
                agents={agents}
                members={members}
                selectedAgent={selectedAgent}
                selectedUser={selectedUser}
                onAgentChange={handleAgentChange}
                onUserChange={handleUserChange}
              />
            </div>
          ) : null}
          {rowsPerPageControl}
        </div>
        {!threads.length ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <span className="text-lg font-medium">No audit events found</span>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto px-2 pb-2 pt-2">
              <AuditTable
                threads={threads}
                sort={sort}
                columnsDenyList={columnsDenyList}
                onSortChange={handleSortChange}
                onRowClick={handleThreadSelect}
                selectedAgent={selectedAgent}
                selectedUser={selectedUser}
              />
            </div>
            <div className="border-t border-border bg-sidebar/40 px-4 py-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePrevPage();
                      }}
                      aria-disabled={!pagination?.hasPrev}
                      tabIndex={!pagination?.hasPrev ? -1 : 0}
                      className={
                        !pagination?.hasPrev
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }
                    />
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
                      className={
                        !pagination?.hasMore
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AuditListErrorFallback() {
  return (
    <div className="flex justify-center items-center h-64">
      <Alert variant="destructive" className="max-w-xl">
        <AlertTitle>Error loading activity</AlertTitle>
        <AlertDescription>
          Something went wrong while loading the activity data.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function AuditList() {
  return (
    <div className="h-full w-full text-foreground overflow-x-auto p-4 flex flex-col gap-2">
      <ErrorBoundary fallback={<AuditListErrorFallback />}>
        <AuditListContent />
      </ErrorBoundary>
    </div>
  );
}
