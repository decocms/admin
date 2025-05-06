import { useListTriggers } from "@deco/sdk";
import type { Trigger } from "@deco/sdk";
import { Input } from "@deco/ui/components/input.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useState } from "react";
import { TriggerCardList } from "./TriggerCardList.tsx";
import { TriggerDetails } from "./triggerDetails.tsx";
import { TriggerTableList } from "./TriggerTableList.tsx";
import { AddTriggerModal } from "./AddTriggerModal.tsx";

const SORTABLE_KEYS = ["title", "type", "agent", "author"] as const;
type SortKey = typeof SORTABLE_KEYS[number];
type SortDirection = "asc" | "desc";
type ViewMode = "table" | "cards";

export function ListTriggers() {
  const { data, isLoading } = useListTriggers();
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);

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

  if (selectedTrigger) {
    return (
      <TriggerDetails
        trigger={selectedTrigger}
        agentId={selectedTrigger.agent?.id || ""}
        onBack={() => setSelectedTrigger(null)}
      />
    );
  }

  if (isLoading) {
    return <div className="py-12 text-center">Loading...</div>;
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
          <AddTriggerModal />
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
              onTriggerClick={setSelectedTrigger}
            />
          </div>
        )
        : (
          <TriggerCardList
            triggers={sortedTriggers}
            onTriggerClick={setSelectedTrigger}
            className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          />
        )}
    </div>
  );
}
