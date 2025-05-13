import type { Trigger } from "@deco/sdk";
import { useListTriggers } from "@deco/sdk";
import { Input } from "@deco/ui/components/input.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense, useState } from "react";
import { useNavigateWorkspace } from "../../hooks/useNavigateWorkspace.ts";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { AddTriggerModal } from "./addTriggerModal.tsx";
import { Table, TableColumn } from "../common/Table.tsx";
import { TriggerActions } from "./triggerActions.tsx";
import { AgentInfo, DateTimeCell, UserInfo } from "../common/TableCells.tsx";
import { TriggerType } from "./triggerType.tsx";
import { ViewModeSwitcher } from "../common/ViewModelSwitcher.tsx";
import { TriggerCard } from "./triggerCard.tsx";

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

const TABS = {
  list: {
    Component: ListTriggers,
    title: "Triggers",
    initialOpen: true,
  },
};

export default function ListTriggersLayout() {
  return (
    <PageLayout
      displayViewsTrigger={false}
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb
          icon="conversion_path"
          list="Triggers"
        />
      }
      actionButtons={<AddTriggerModal />}
    />
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
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const triggers: Trigger[] = data?.actions || [];

  const filteredTriggers = search.trim().length > 0
    ? triggers.filter((t) =>
      t.title.toLowerCase().includes(search.toLowerCase())
    )
    : triggers;

  if (isLoading) {
    return <ListTriggersSkeleton />;
  }

  return (
    <div className="py-4 flex flex-col gap-4 h-full">
      <div className="px-4 flex items-center justify-end gap-2">
        <ViewModeSwitcher
          viewMode={viewMode}
          onChange={(mode) => setViewMode(mode)}
        />
        <Input
          type="text"
          placeholder="Search trigger"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
        />
      </div>

      <div className="flex-1 min-h-0 px-4 overflow-x-auto">
        {viewMode === "table"
          ? <TableView triggers={filteredTriggers} />
          : <CardsView triggers={filteredTriggers} />}
      </div>
    </div>
  );
}

function TableView({ triggers }: { triggers: Trigger[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  const navigate = useNavigateWorkspace();

  function handleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDirection("asc");
    }
  }

  function getSortValue(trigger: Trigger, key: SortKey): string {
    if (key === "agent") return trigger.agent?.name?.toLowerCase() || "";
    if (key === "author") return trigger.author?.name?.toLowerCase() || "";
    return (trigger[key] as string)?.toLowerCase?.() || "";
  }

  const sortedTriggers = [...triggers].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  function handleTriggerClick(trigger: Trigger) {
    if (!openModalId && trigger.agent?.id && trigger.id) {
      navigate(`/trigger/${trigger.agent.id}/${trigger.id}`);
    }
  }

  const columns: TableColumn<Trigger>[] = [
    {
      id: "title",
      header: "Name",
      accessor: (t) => t.title,
      sortable: true,
    },
    {
      id: "type",
      header: "Trigger",
      render: (t) => <TriggerType trigger={t} />,
      sortable: true,
    },
    {
      id: "agent",
      header: "Agent",
      render: (t) => <AgentInfo agentId={t.agent?.id} />,
      sortable: true,
    },
    {
      id: "author",
      header: "Created by",
      render: (t) => <UserInfo userId={t.author?.id} />,
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Created at",
      render: (t) => <DateTimeCell value={t.createdAt} />,
    },
    {
      id: "actions",
      header: "",
      render: (t) => (
        <TriggerActions
          trigger={t}
          open={openModalId === t.id}
          onOpenChange={(val: boolean) => setOpenModalId(val ? t.id : null)}
        />
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={sortedTriggers}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={handleTriggerClick}
    />
  );
}

function CardsView({ triggers }: { triggers: Trigger[] }) {
  const navigate = useNavigateWorkspace();
  function handleTriggerClick(trigger: Trigger) {
    if (trigger.agent?.id && trigger.id) {
      navigate(`/trigger/${trigger.agent.id}/${trigger.id}`);
    }
  }
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {triggers.map((trigger, index) => (
        <TriggerCard
          key={`trigger-card-${trigger.id}-${index}`}
          trigger={trigger}
          onClick={handleTriggerClick}
        />
      ))}
    </div>
  );
}
