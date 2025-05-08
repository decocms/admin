import type { Trigger } from "@deco/sdk";
import { useListTriggers } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense, useState } from "react";
import { useNavigateWorkspace } from "../../hooks/useNavigateWorkspace.ts";
import { TriggerCardList } from "./TriggerCardList.tsx";
import { TriggerTableList } from "./TriggerTableList.tsx";
import { AddTriggerModal as AddTriggerModalButton } from "./addTriggerModal.tsx";

const SORTABLE_KEYS = ["title", "type", "agent", "author"] as const;
type SortKey = typeof SORTABLE_KEYS[number];
type SortDirection = "asc" | "desc";
type ViewMode = "table" | "cards";

function ListTriggersSkeleton() {
  return (
    <div className="mx-8 my-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="w-80 h-10 rounded-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-36 h-10 rounded-full" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div>
          <div className="flex flex-col divide-y divide-slate-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <Skeleton className="w-64 h-6 rounded" />
                <Skeleton className="w-44 h-6 rounded" />
                <Skeleton className="w-32 h-6 rounded" />
                <Skeleton className="w-64 h-6 rounded" />
                <Skeleton className="w-40 h-6 rounded" />
                <Skeleton className="w-8 h-6 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListTriggers() {
  return (
    <Suspense fallback={<ListTriggersSkeleton />}>
      <ListTriggersSuspended />
    </Suspense>
  );
}

function ListTriggersSuspended() {
  const { data, isLoading } = useListTriggers();
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const navigate = useNavigateWorkspace();

  const triggers: Trigger[] = data?.actions || [];

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  function getSortValue(trigger: Trigger, key: SortKey): string {
    if (key === "agent") return trigger.agent?.name?.toLowerCase() || "";
    if (key === "author") return trigger.author?.name?.toLowerCase() || "";
    return (trigger[key] as string)?.toLowerCase?.() || "";
  }

  const filteredTriggers = search.trim().length > 0
    ? triggers.filter((t) =>
      t.title.toLowerCase().includes(search.toLowerCase())
    )
    : triggers;

  const sortedTriggers = [...filteredTriggers].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  function handleTriggerClick(trigger: Trigger) {
    if (trigger.agent?.id && trigger.id) {
      navigate(`/trigger/${trigger.agent.id}/${trigger.id}`);
    }
  }

  if (isLoading) {
    return <ListTriggersSkeleton />;
  }

  return (
    <div className="mx-8 my-6">
      <div className="mb-4 flex items-center justify-between">
        <Input
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80 rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
        />
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "cards" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Card view"
            onClick={() => setViewMode("cards")}
            className={viewMode === "cards" ? "bg-slate-100" : ""}
          >
            <Icon
              name="grid_view"
              size={24}
              className={viewMode === "cards"
                ? "text-primary"
                : "text-slate-500"}
            />
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Table view"
            onClick={() => setViewMode("table")}
            className={viewMode === "table" ? "bg-slate-100" : ""}
          >
            <Icon
              name="menu"
              size={24}
              className={viewMode === "table"
                ? "text-primary"
                : "text-slate-500"}
            />
          </Button>
          <AddTriggerModalButton />
        </div>
      </div>
      {viewMode === "table"
        ? (
          <div className="overflow-x-auto">
            <TriggerTableList
              triggers={sortedTriggers}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              onTriggerClick={handleTriggerClick}
            />
          </div>
        )
        : (
          <TriggerCardList
            triggers={sortedTriggers}
            onTriggerClick={handleTriggerClick}
            className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          />
        )}
    </div>
  );
}
