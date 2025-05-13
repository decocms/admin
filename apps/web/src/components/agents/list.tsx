import type { Agent } from "@deco/sdk";
import {
  useAgents,
  useCreateAgent,
  useIntegration,
  useRemoveAgent,
  useUpdateThreadMessages,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card as UICard, CardContent } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  createContext,
  Suspense,
  useContext,
  useReducer,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { trackEvent } from "../../hooks/analytics.ts";
import { useAgentHasChanges } from "../../hooks/useAgentOverrides.ts";
import { Avatar } from "../common/Avatar.tsx";
import { EmptyState } from "../common/EmptyState.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { useEditAgent, useFocusChat } from "./hooks.ts";
import { ViewModeSwitcher } from "../common/ViewModelSwitcher.tsx";
import { Table } from "../common/Table.tsx";

export const useDuplicateAgent = (agent: Agent | null) => {
  const [duplicating, setDuplicating] = useState(false);
  const focusEditAgent = useEditAgent();
  const createAgent = useCreateAgent();

  const duplicate = async () => {
    if (!agent) return;

    try {
      setDuplicating(true);
      const duplicatedAgent = await createAgent.mutateAsync({
        name: `${agent.name} (Copy)`,
        id: crypto.randomUUID(),
        description: agent.description,
        instructions: agent.instructions,
        avatar: agent.avatar,
        tools_set: agent.tools_set,
        model: agent.model,
        views: agent.views,
      });
      focusEditAgent(duplicatedAgent.id, crypto.randomUUID(), {
        history: false,
      });

      trackEvent("agent_duplicate", {
        success: true,
        data: duplicatedAgent,
      });
    } catch (error) {
      console.error("Error duplicating agent:", error);

      trackEvent("agent_duplicate", {
        success: false,
        error,
      });
    } finally {
      setDuplicating(false);
    }
  };

  return { duplicate, duplicating };
};

function IntegrationMiniature({ toolSetId }: { toolSetId: string }) {
  const { data: integration } = useIntegration(toolSetId);
  const navigate = useNavigate();

  if (!integration) {
    return null;
  }

  const icon = integration.icon || "icon://conversion_path";

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/integration/${integration.id}`);
          }}
          asChild
        >
          <div className="w-8 h-8 flex items-center justify-center border border-input rounded-lg overflow-hidden">
            {icon.startsWith("icon://")
              ? (
                <Icon
                  name={icon.replace("icon://", "")}
                  className="text-base rounded-none"
                />
              )
              : (
                <Avatar
                  url={icon}
                  fallback={integration.name.substring(0, 2)}
                  objectFit="contain"
                  className="h-full w-full rounded-none"
                />
              )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{integration.name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function IntegrationBadges({ agent, max }: { agent: Agent; max?: number }) {
  const { hasChanges } = useAgentHasChanges(agent.id);
  const integrations = Object
    .entries(agent.tools_set ?? {})
    .filter(([_, tools]) => tools.length > 0)
    .slice(0, max ?? Infinity);
  return (
    <>
      {hasChanges
        ? (
          <div className="text-xs text-slate-700 font-medium h-8 border border-slate-200 rounded-full flex items-center justify-center gap-1 w-fit px-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            Unsaved Changes
          </div>
        )
        : (
          <div className="flex gap-2 flex-wrap">
            {integrations.map(([toolSetId]) => (
              <ErrorBoundary key={toolSetId} fallback={null}>
                <Suspense fallback={null}>
                  <IntegrationMiniature toolSetId={toolSetId} />
                </Suspense>
              </ErrorBoundary>
            ))}
          </div>
        )}
    </>
  );
}

function Actions({ agent }: { agent: Agent }) {
  const focusEditAgent = useEditAgent();
  const { duplicate, duplicating } = useDuplicateAgent(agent);
  const removeAgent = useRemoveAgent();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function handleDelete() {
    await removeAgent.mutateAsync(agent.id);
    setDeleteDialogOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="more_horiz" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            disabled={duplicating}
            onClick={(e) => {
              e.stopPropagation();
              focusEditAgent(agent.id, crypto.randomUUID(), { history: false });
            }}
          >
            <Icon name="edit" className="mr-2" />
            Edit agent
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={duplicating}
            onClick={(e) => {
              e.stopPropagation();
              duplicate();
            }}
          >
            <Icon name="content_copy" className="mr-2" />
            {duplicating ? "Duplicating..." : "Duplicate"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialogOpen(true);
            }}
          >
            <Icon name="delete" className="mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {agent.name}{" "}
              agent. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await handleDelete();
              }}
              disabled={removeAgent.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removeAgent.isPending
                ? (
                  <>
                    <Spinner size="xs" />
                    <span className="ml-2">Deleting...</span>
                  </>
                )
                : (
                  "Delete"
                )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Card({ agent }: { agent: Agent }) {
  const focusChat = useFocusChat();
  if (!agent) {
    return (
      <UICard className="shadow-sm hover:shadow-md transition-shadow rounded-2xl">
        <CardContent className="p-4 flex items-center justify-center h-[166px]">
          <Spinner />
        </CardContent>
      </UICard>
    );
  }
  return (
    <UICard
      className="group cursor-pointer hover:shadow-md transition-shadow flex flex-col rounded-2xl p-4 border-slate-200 h-full"
      onClick={() => {
        focusChat(agent.id, crypto.randomUUID(), {
          history: false,
        });
      }}
    >
      <CardContent className="gap-4 flex flex-col flex-grow">
        <div className="flex flex-col gap-3 w-full">
          <div className="relative w-full">
            <div className="h-12 w-12 flex justify-center overflow-hidden rounded-lg shadow-sm">
              <Avatar
                url={agent.avatar && /^(data:)|(https?:)/.test(agent.avatar)
                  ? agent.avatar
                  : undefined}
                fallback={agent.avatar &&
                    !/^(data:)|(https?:)/.test(agent.avatar)
                  ? agent.avatar
                  : agent.name.substring(0, 2)}
                className="h-full w-full rounded-lg"
              />
            </div>
            <div
              className="absolute top-0 right-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Actions agent={agent} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-slate-800 font-semibold truncate">
              {agent.name}
            </div>
            <div className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem]">
              {agent.description || "No description"}
            </div>
          </div>
          <IntegrationBadges agent={agent} />
        </div>
      </CardContent>
    </UICard>
  );
}

interface ListState {
  filter: string;
}

type ListAction = { type: "SET_FILTER"; payload: string };

const initialState: ListState = {
  filter: "",
};

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_FILTER":
      return { ...state, filter: action.payload };
    default:
      return state;
  }
}

function TableView({ agents }: {
  agents: Agent[];
}) {
  const focusChat = useFocusChat();
  const [sortKey, setSortKey] = useState<"name" | "description">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(agent: Agent, key: "name" | "description"): string {
    if (key === "description") return agent.description?.toLowerCase() || "";
    return agent.name?.toLowerCase() || "";
  }
  const sortedAgents = [...agents].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns = [
    {
      id: "name",
      header: "Name",
      render: (agent: Agent) => (
        <div className="flex items-center gap-2">
          <Avatar
            url={agent.avatar}
            fallback={agent.name.substring(0, 2)}
            className="h-8 w-8 rounded-lg"
          />
          <span className="font-medium">{agent.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      accessor: (agent: Agent) => agent.description,
      sortable: true,
      cellClassName: "max-w-xl",
    },
    {
      id: "integrations",
      header: "Integrations",
      render: (agent: Agent) => <IntegrationBadges agent={agent} max={5} />,
    },
    {
      id: "actions",
      header: "",
      render: (agent: Agent) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Actions agent={agent} />
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={sortedAgents}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={(key) => {
        if (sortKey === key) {
          setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
          setSortKey(key as "name" | "description");
          setSortDirection("asc");
        }
      }}
      onRowClick={(agent) => {
        focusChat(agent.id, crypto.randomUUID(), {
          history: false,
        });
      }}
    />
  );
}

function CardsView({ agents }: {
  agents: Agent[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3 peer">
      {agents.map((agent) => (
        <div key={agent.id} className="relative group">
          <Card agent={agent} />
        </div>
      ))}
    </div>
  );
}

function List() {
  const [state, dispatch] = useReducer(listReducer, initialState);
  const { creating, handleCreate } = useContext(Context)!;
  const { filter } = state;
  const { data: agents } = useAgents();
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const filteredAgents =
    agents?.filter((agent) =>
      agent.name.toLowerCase().includes(filter.toLowerCase())
    ) ?? [];
  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <div className="flex items-center justify-end gap-2">
        <ViewModeSwitcher viewMode={viewMode} onChange={setViewMode} />
        <Input
          className="w-80 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
          placeholder="Search agent"
          value={filter}
          onChange={(e) =>
            dispatch({ type: "SET_FILTER", payload: e.target.value })}
        />
      </div>
      {!agents
        ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size="lg" />
          </div>
        )
        : agents.length > 0
        ? (
          <div className="flex-1 min-h-0 overflow-x-auto">
            {viewMode === "table"
              ? (
                <TableView
                  agents={filteredAgents}
                />
              )
              : (
                <CardsView
                  agents={filteredAgents}
                />
              )}
            <div className="flex-col items-center justify-center h-48 peer-empty:flex hidden">
              <Icon
                name="search_off"
                className="mb-2 text-4xl text-muted-foreground"
              />
              <p className="text-muted-foreground">
                No agents match your filter. Try adjusting your search.
              </p>
            </div>
          </div>
        )
        : (
          <EmptyState
            icon="groups"
            title="No agents yet"
            description="Create an agent to automate tasks and improve your workflow."
            buttonProps={{
              disabled: creating,
              children: creating ? "Creating..." : "Create Agent",
              onClick: handleCreate,
            }}
          />
        )}
    </div>
  );
}

const TABS = {
  list: {
    Component: List,
    title: "Agents",
    initialOpen: true,
  },
};

const Context = createContext<
  {
    creating: boolean;
    handleCreate: () => void;
  } | null
>(null);

export default function Page() {
  const focusEditAgent = useEditAgent();
  const [creating, setCreating] = useState(false);
  const createAgent = useCreateAgent();
  const updateThreadMessages = useUpdateThreadMessages();

  const handleCreate = async () => {
    try {
      setCreating(true);
      const agent = await createAgent.mutateAsync({});
      updateThreadMessages(agent.id);
      focusEditAgent(agent.id, crypto.randomUUID(), { history: false });

      trackEvent("agent_create", {
        success: true,
        data: agent,
      });
    } catch (error) {
      console.error("Error creating new agent:", error);

      trackEvent("agent_create", {
        success: false,
        error,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Context.Provider value={{ creating, handleCreate }}>
      <PageLayout
        displayViewsTrigger={false}
        tabs={TABS}
        breadcrumb={<DefaultBreadcrumb icon="groups" list="Agents" />}
        actionButtons={
          <Button
            onClick={handleCreate}
            disabled={creating}
            variant="special"
            className="gap-2"
          >
            {creating
              ? (
                <>
                  <Spinner size="xs" />
                  Creating...
                </>
              )
              : (
                <>
                  <Icon name="add" />
                  Create Agent
                </>
              )}
          </Button>
        }
      />
    </Context.Provider>
  );
}
