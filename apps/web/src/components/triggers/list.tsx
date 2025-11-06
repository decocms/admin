import type { TriggerOutput } from "@deco/sdk";
import { useAgents, useIntegrations, useListTriggers } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense, useCallback, useMemo, useState } from "react";
import {
  useThreadManagerOptional,
  buildTriggerUri,
} from "../decopilot/thread-context-manager.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { TabActionButton } from "../canvas/tab-action-button.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import {
  AgentInfo,
  DateTimeCell,
  IntegrationInfo,
  UserInfo,
} from "../common/table/table-cells.tsx";
import { TriggerActions } from "./trigger-actions.tsx";
import { TriggerCard } from "./trigger-card.tsx";
import { TriggerModal } from "./trigger-dialog.tsx";
import { TriggerToggle } from "./trigger-toggle.tsx";
import { TriggerType } from "./trigger-type.tsx";

const SORTABLE_KEYS = ["title", "type", "target", "author"] as const;

type SortKey = (typeof SORTABLE_KEYS)[number];
type SortDirection = "asc" | "desc";

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
          <div className="flex flex-col divide-y divide-border">
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

interface ListTriggersProps {
  searchTerm?: string;
  viewMode?: "cards" | "table";
}

export default function ListTriggers({
  searchTerm = "",
  viewMode = "cards",
}: ListTriggersProps) {
  return (
    <Suspense fallback={<ListTriggersSkeleton />}>
      <ListTriggersSuspended searchTerm={searchTerm} viewMode={viewMode} />
    </Suspense>
  );
}

function ListTriggersSuspended({
  searchTerm = "",
  viewMode: initialViewMode = "cards",
}: {
  searchTerm?: string;
  viewMode?: "cards" | "table";
}) {
  const { data, isLoading } = useListTriggers();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const viewMode = initialViewMode;
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const threadManager = useThreadManagerOptional();
  const addTab = threadManager?.addTab;
  const navigate = useNavigateWorkspace();
  const { data: agents } = useAgents();
  const { data: integrations = [] } = useIntegrations();

  const triggers = (data?.triggers || []) as TriggerOutput[];

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const handleTriggerClick = useCallback(
    (trigger: TriggerOutput) => {
      if (addTab) {
        addTab({
          type: "detail",
          resourceUri: buildTriggerUri(trigger.id),
          title: trigger.data.title || "Trigger",
          icon: "cable",
        });
      } else {
        navigate(`/trigger/${trigger.id}`);
      }
    },
    [addTab, navigate],
  );

  const filteredTriggers = useMemo(() => {
    const filtered =
      searchTerm.trim().length > 0
        ? triggers.filter((t) =>
            t.data.title.toLowerCase().includes(searchTerm.toLowerCase()),
          )
        : triggers;

    // Sort triggers
    return [...filtered].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [triggers, searchTerm, sortKey, sortDirection, agents, integrations]);

  function getSortValue(trigger: TriggerOutput, key: SortKey): string {
    if (key === "target") {
      const data = trigger.data;

      // For agent triggers - use type guard to handle the schema
      if ("agentId" in data && data.agentId) {
        const agent = agents?.find((a) => a.id === data.agentId);
        return agent?.name?.toLowerCase() || "";
      }

      // For tool triggers - use type guard to handle the complex union type
      if ("callTool" in data && data.callTool) {
        const integration = integrations.find(
          (i) => i.id === data.callTool.integrationId,
        );
        return (
          integration?.name?.toLowerCase() ||
          data.callTool.integrationId.toLowerCase()
        );
      }

      return "";
    }
    if (key === "author") {
      return trigger.user?.metadata?.full_name?.toLowerCase() || "";
    }
    if (key === "title" || key === "type") {
      return trigger.data?.[key]?.toLowerCase?.() || "";
    }
    return "";
  }

  if (isLoading) {
    return <ListTriggersSkeleton />;
  }

  return (
    <>
      <TabActionButton>
        <Button
          variant="default"
          size="xs"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Icon name="add" />
          New trigger
        </Button>
      </TabActionButton>

      {isCreateModalOpen && (
        <TriggerModal
          isOpen={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
        />
      )}

      {filteredTriggers.length === 0 ? (
        <EmptyState
          icon="cable"
          title={
            searchTerm.trim().length > 0
              ? "No triggers found"
              : "No triggers yet"
          }
          description={
            searchTerm.trim().length > 0
              ? "Try adjusting your search terms to find what you're looking for."
              : "Create your first trigger to automate your agent workflows and respond to events automatically."
          }
        />
      ) : viewMode === "table" ? (
        <div className="w-fit min-w-full">
          <TableView
            triggers={filteredTriggers}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTriggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              onClick={handleTriggerClick}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TableView({
  triggers,
  sortKey,
  sortDirection,
  onSort,
}: {
  triggers: TriggerOutput[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  const threadManager = useThreadManagerOptional();
  const addTab = threadManager?.addTab;
  const navigate = useNavigateWorkspace();
  const { data: integrations = [] } = useIntegrations();

  function TargetInfo({ trigger }: { trigger: TriggerOutput }) {
    const data = trigger.data;

    // For agent triggers - use type assertion to handle the schema
    if ("agentId" in data && data.agentId) {
      return <AgentInfo agentId={data.agentId} />;
    }

    // For tool triggers - use type assertion to handle the complex union type
    if ("callTool" in data && data.callTool) {
      const integration = integrations.find(
        (i) => i.id === data.callTool.integrationId,
      );
      const toolName = data.callTool.toolName;

      return <IntegrationInfo integration={integration} toolName={toolName} />;
    }

    return <span className="text-muted-foreground">Unknown target</span>;
  }

  function handleSort(key: string) {
    const k = key as SortKey;
    onSort(k);
  }

  const handleTriggerClick = useCallback(
    (trigger: TriggerOutput) => {
      if (!openModalId) {
        if (addTab) {
          addTab({
            type: "detail",
            resourceUri: buildTriggerUri(trigger.id),
            title: trigger.data.title || "Trigger",
            icon: "cable",
          });
        } else {
          navigate(`/trigger/${trigger.id}`);
        }
      }
    },
    [openModalId, addTab, navigate],
  );

  const columns: TableColumn<TriggerOutput>[] = [
    {
      id: "active",
      header: "Active",
      render: (t) => <TriggerToggle trigger={t} />,
    },
    {
      id: "title",
      header: "Name",
      accessor: (t) => t.data.title,
      sortable: true,
    },
    {
      id: "type",
      header: "Trigger",
      render: (t) => <TriggerType trigger={t} />,
      sortable: true,
    },
    {
      id: "target",
      header: "Target",
      render: (t) => <TargetInfo trigger={t} />,
      sortable: true,
    },
    {
      id: "author",
      header: "Created by",
      render: (t) => <UserInfo userId={t.user?.id} />,
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
      data={triggers}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={handleTriggerClick}
    />
  );
}
