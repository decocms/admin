import {
  AI_APP_PRD_TEMPLATE,
  findPinnedView,
  Integration,
  useConnectionViews,
  useUpsertDocument,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import {
  buildAppsListUri,
  useThreadManager,
} from "../decopilot/thread-context-manager.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { useThreadTitle } from "../decopilot/index.tsx";
import { SearchComingSoonModal } from "../modals/search-coming-soon-modal.tsx";
import {
  CommandPalette,
  useCommandPalette,
} from "../search/command-palette.tsx";
import { SidebarFooter } from "./footer.tsx";
import { TogglePin } from "../views/list.tsx";
import { useCurrentTeam } from "./team-selector.tsx";
import { usePinnedTabs, type PinnedTab } from "../../hooks/use-pinned-tabs.ts";
import { WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { useFocusChat } from "../agents/hooks.ts";

const useFocusTeamAgent = () => {
  const focusChat = useFocusChat();
  const handleCreate = () => {
    focusChat(WELL_KNOWN_AGENT_IDS.teamAgent, crypto.randomUUID(), {
      history: false,
    });
  };

  return handleCreate;
};

/**
 * Individual thread item with title
 */
function ThreadListItem({
  thread,
  isActive,
}: {
  thread: { id: string; createdAt: number };
  isActive: boolean;
}) {
  const { switchToThread, hideThread } = useThreadManager();
  const decopilotAgentId = WELL_KNOWN_AGENTS.decopilotAgent.id;
  const threadTitle = useThreadTitle(thread.id, decopilotAgentId, "New chat");

  return (
    <SidebarMenuItem key={thread.id}>
      <SidebarMenuButton
        className={`w-full pr-2 group/thread relative cursor-pointer ${
          isActive ? "bg-accent" : ""
        }`}
        onClick={() => {
          switchToThread(thread.id);
          trackEvent("sidebar_thread_switch", {
            threadId: thread.id,
          });
        }}
      >
        <div className="flex-1 min-w-0 flex flex-col items-start">
          <span className="truncate text-sm w-full">{threadTitle}</span>
        </div>
        {!isActive && (
          <Icon
            name="close"
            size={16}
            className="text-muted-foreground opacity-0 group-hover/thread:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              hideThread(thread.id);
              trackEvent("sidebar_thread_hide", {
                threadId: thread.id,
              });
            }}
          />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Renders the list of recent chat threads
 */
function RecentThreadsList() {
  const { getAllThreads, activeThreadId } = useThreadManager();
  const threads = getAllThreads();
  const maxThreads = 5; // Show up to 5 recent threads

  // Get the most recent threads (limited)
  const recentThreads = threads.slice(0, maxThreads);

  if (recentThreads.length === 0) {
    return (
      <SidebarMenuItem>
        <div className="px-4 py-2 text-xs text-muted-foreground text-center">
          No recent chats
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <>
      {recentThreads.map((thread) => (
        <Suspense key={thread.id} fallback={<ThreadItemSkeleton />}>
          <ThreadListItem
            thread={thread}
            isActive={thread.id === activeThreadId}
          />
        </Suspense>
      ))}
    </>
  );
}

/**
 * Skeleton for loading thread items
 */
function ThreadItemSkeleton() {
  return (
    <SidebarMenuItem>
      <div className="flex items-center gap-2 px-2 py-2">
        <Skeleton className="size-[18px] rounded shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </SidebarMenuItem>
  );
}

function AddViewsDialog({
  integration,
  open,
  onOpenChange,
}: {
  integration: Integration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentTeam = useCurrentTeam();
  const { data: viewsData, isLoading: isLoadingViews } = useConnectionViews(
    integration,
    false,
  );
  const views = viewsData?.views || [];

  // Check which views are already added to the team
  const viewsWithStatus = useMemo(() => {
    if (!views || views.length === 0 || !currentTeam.views) return [];

    return views.map((view) => {
      const existingView = findPinnedView(currentTeam.views, integration.id, {
        name: view.name,
        url: view.url,
      });

      return {
        ...view,
        integration: integration,
        isAdded: !!existingView,
        teamViewId: existingView?.id,
      } as typeof view & {
        isAdded: boolean;
        teamViewId?: string;
        integration: Integration;
      };
    });
  }, [views, currentTeam.views, integration.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Views from {integration.name}</DialogTitle>
          <DialogDescription>
            Select views to add to your sidebar from this integration.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto">
          {isLoadingViews ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : viewsWithStatus.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {views.length === 0
                ? "No views available from this integration"
                : "All available views have already been added"}
            </div>
          ) : (
            <div className="space-y-2">
              {viewsWithStatus.map((view) => (
                <div
                  key={view.name ?? view.url ?? view.title}
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {view.icon && (
                      <Icon
                        name={view.icon}
                        size={20}
                        className="flex-shrink-0 text-muted-foreground"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium truncate">
                        {view.title}
                      </h4>
                      {view.url && (
                        <p className="text-xs text-muted-foreground truncate">
                          {view.url}
                        </p>
                      )}
                    </div>
                  </div>
                  <TogglePin view={view} />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceViews() {
  const { org, project } = useParams();
  const workspaceLink = useWorkspaceLink();
  const { isMobile, toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const [addViewsDialogState, setAddViewsDialogState] = useState<{
    open: boolean;
    integration?: Integration;
  }>({ open: false });
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [databaseModalOpen, setDatabaseModalOpen] = useState(false);
  const [_searchModalOpen, _setSearchModalOpen] = useState(false);

  // Thread management
  const { createThread } = useThreadManager();

  // Pinned resources
  // Use team locator if params aren't available - fallback to just undefined if no params
  const projectKey = org && project ? `${org}/${project}` : undefined;
  const { pinnedTabs, unpinTab, reorderPinnedTabs } = usePinnedTabs(projectKey);

  // Canvas tabs management
  const { addTab, tabs, setActiveTab } = useThreadManager();

  // Drag and drop state for pinned tabs
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [isDragMode, setIsDragMode] = useState(false);
  const draggedItemIdRef = useRef<string | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();

    const tab = pinnedTabs[index];
    if (!tab) return;

    setDraggedItem(index);
    draggedItemIdRef.current = tab.id;

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tab.id);

    if (e.currentTarget instanceof HTMLElement) {
      const offsetX = 20;
      const offsetY = e.currentTarget.offsetHeight / 2;
      e.dataTransfer.setDragImage(e.currentTarget, offsetX, offsetY);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    const draggedId = draggedItemIdRef.current;
    if (!draggedId) {
      handleDragEnd();
      return;
    }

    const fromIndex = pinnedTabs.findIndex((tab) => tab.id === draggedId);
    if (fromIndex === -1 || fromIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    reorderPinnedTabs(fromIndex, dropIndex);
    handleDragEnd();
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    draggedItemIdRef.current = null;
  };

  // Command palette
  const commandPalette = useCommandPalette();
  const [commandPaletteInitialSearch, setCommandPaletteInitialSearch] =
    useState("");
  const [commandPaletteInitialFilter, setCommandPaletteInitialFilter] =
    useState<"agent" | "app" | "document" | "thread" | undefined>();

  // Hook for creating documents
  const upsertDocument = useUpsertDocument();

  const handleCreateAgent = useFocusTeamAgent();

  const handleOpenSearch = () => {
    commandPalette.setOpen(true);
  };

  function buildResourceHrefFromResource(resource: {
    integration_id: string;
    name: string;
  }): string {
    return workspaceLink(`/rsc/${resource.integration_id}/${resource.name}`);
  }

  const renderPinnedTabIcon = (tab: PinnedTab) => {
    if (!tab.icon) {
      return (
        <Icon
          name="keep"
          size={18}
          className="text-muted-foreground/60 shrink-0"
        />
      );
    }

    const isAppTab = tab.resourceUri.startsWith("app://");

    if (isAppTab) {
      return (
        <IntegrationIcon
          icon={tab.icon}
          name={tab.title}
          size="xs"
          className="!w-[18px] !h-[18px] shrink-0"
        />
      );
    }

    if (tab.icon.startsWith("http") || tab.icon.startsWith("/")) {
      return (
        <img
          src={tab.icon}
          alt=""
          className="size-[18px] rounded-sm shrink-0 object-cover"
        />
      );
    }

    return (
      <Icon
        name={tab.icon}
        size={18}
        className="text-muted-foreground/75 shrink-0"
      />
    );
  };

  const getDragProps = (index: number, tabId: string) => ({
    draggable: isDragMode,
    onDragStart: isDragMode
      ? (e: React.DragEvent) => handleDragStart(e, index)
      : undefined,
    onDragOver: isDragMode
      ? (e: React.DragEvent) => handleDragOver(e)
      : undefined,
    onDrop: isDragMode
      ? (e: React.DragEvent) => handleDrop(e, index)
      : undefined,
    onDragEnd: isDragMode ? handleDragEnd : undefined,
    className: isDragMode
      ? `cursor-grab active:cursor-grabbing transition-all duration-150 ${
          draggedItem !== null && draggedItemIdRef.current === tabId
            ? "opacity-50"
            : ""
        }`
      : "",
  });

  const renderPinnedTab = (tab: PinnedTab, index: number) => (
    <SidebarMenuItem key={tab.id} {...getDragProps(index, tab.id)}>
      <SidebarMenuButton
        className="w-full pr-2 group/item relative cursor-pointer"
        onClick={(e) => {
          if (isDragMode) {
            e.preventDefault();
            return;
          }
          e.preventDefault();

          // Check if a tab with this resourceUri already exists
          const existingTab = tabs.find(
            (t) => t.resourceUri === tab.resourceUri,
          );

          if (existingTab) {
            // Switch to existing tab instead of creating a new one
            setActiveTab(existingTab.id);
          } else {
            // Create new tab if it doesn't exist
            addTab({
              type: tab.type,
              resourceUri: tab.resourceUri,
              title: tab.title,
              icon: tab.icon,
            });
          }

          trackEvent("sidebar_navigation_click", {
            item: tab.title,
            type: "pinned-tab",
          });
          isMobile && toggleSidebar();
        }}
      >
        {isDragMode && (
          <Icon
            name="drag_indicator"
            size={16}
            className="text-muted-foreground shrink-0"
          />
        )}
        {renderPinnedTabIcon(tab)}
        <span className="truncate flex-1 min-w-0 group-hover/item:pr-8">
          {tab.title}
        </span>
        <Icon
          name="keep_off"
          size={18}
          className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            unpinTab(tab.resourceUri);
          }}
        />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <>
      {/* SECTION 1: SEARCH + RESOURCE INSTANCES */}

      {/* Search button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer justify-between"
          onClick={() => handleOpenSearch()}
        >
          <div className="flex items-center gap-2">
            <Icon
              name="search"
              size={20}
              className="text-muted-foreground/75"
            />
            <span className="truncate">Search</span>
          </div>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded-md border border-border bg-transparent px-1.5 text-[10px] font-normal text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {/* Generate button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => setGenerateModalOpen(true)}
        >
          <Icon name="add" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Generate</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {/* Manage Apps button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            addTab({
              type: "list",
              resourceUri: buildAppsListUri(),
              title: "Apps",
              icon: "grid_view",
            });
            trackEvent("sidebar_navigation_click", {
              item: "Apps",
            });
            isMobile && toggleSidebar();
          }}
        >
          <Icon
            name="grid_view"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Apps</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarSeparator className="my-2 -ml-1" />

      {/* SECTION 2: PINNED */}
      <SidebarMenuItem>
        <div className="px-2 py-0 text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>Pinned</span>
          <button
            onClick={() => setIsDragMode(!isDragMode)}
            className="p-1 hover:bg-accent rounded transition-colors"
            title={
              isDragMode
                ? "Click to exit drag mode"
                : "Click to reorder pinned items"
            }
          >
            <Icon
              name={isDragMode ? "lock_open" : "lock"}
              size={14}
              className={
                isDragMode
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }
            />
          </button>
        </div>
      </SidebarMenuItem>

      {/* Render all pinned items in custom order */}
      {pinnedTabs.length === 0 && (
        <SidebarMenuItem>
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Pin tabs from the canvas to keep them here.
          </div>
        </SidebarMenuItem>
      )}
      {pinnedTabs.map((tab, index) => renderPinnedTab(tab, index))}

      {/* SECTION 3: RECENT THREADS */}
      <SidebarSeparator className="my-2 -ml-1" />
      <SidebarMenuItem>
        <div className="px-2 py-0 text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>Recent Threads</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                createThread();
                trackEvent("sidebar_new_thread_click");
              }}
              title="New chat"
              className="size-6"
            >
              <Icon
                name="add"
                size={14}
                className="text-muted-foreground hover:text-foreground"
              />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setCommandPaletteInitialSearch("");
                setCommandPaletteInitialFilter("thread");
                commandPalette.setOpen(true);
                trackEvent("sidebar_thread_selector_open");
              }}
              title="Browse all chats"
              className="size-6"
            >
              <Icon
                name="forum"
                size={14}
                className="text-muted-foreground hover:text-foreground"
              />
            </Button>
          </div>
        </div>
      </SidebarMenuItem>
      <RecentThreadsList />

      {/* Generate Modal */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create via AI</DialogTitle>
            <DialogDescription>Generate content with AI</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Document Creation - Split Button with Dropdown */}
            <div className="w-full flex items-stretch h-auto border border-border rounded-lg overflow-hidden hover:bg-accent/50 transition-colors">
              <Button
                variant="ghost"
                className="flex-1 justify-start h-auto py-4 rounded-none border-0 hover:bg-transparent"
                onClick={async () => {
                  setGenerateModalOpen(false);
                  isMobile && toggleSidebar();
                  const timestamp = new Date()
                    .toISOString()
                    .replace(/[:.]/g, "-");

                  const result = await upsertDocument.mutateAsync({
                    params: {
                      name: `Untitled-${timestamp}`,
                      content: "",
                      description: "",
                    },
                  });

                  const documentResource = {
                    integration_id: "i:documents-management",
                    name: "document",
                  };
                  const href = buildResourceHrefFromResource(documentResource);
                  navigate(`${href}/${encodeURIComponent(result.uri)}`);
                }}
              >
                <div className="flex items-center gap-3 text-left">
                  <Icon
                    name="docs"
                    size={24}
                    className="text-muted-foreground/75 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">Document</div>
                    <div className="text-sm text-muted-foreground">
                      Create a new document with AI assistance
                    </div>
                  </div>
                </div>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-auto rounded-none border-l border-border hover:bg-transparent w-12 flex-shrink-0"
                  >
                    <Icon name="expand_more" size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={async () => {
                      setGenerateModalOpen(false);
                      isMobile && toggleSidebar();
                      const timestamp = new Date()
                        .toISOString()
                        .replace(/[:.]/g, "-");

                      const result = await upsertDocument.mutateAsync({
                        params: {
                          name: `Untitled-${timestamp}`,
                          content: "",
                          description: "",
                        },
                      });

                      const documentResource = {
                        integration_id: "i:documents-management",
                        name: "document",
                      };
                      const href =
                        buildResourceHrefFromResource(documentResource);
                      navigate(`${href}/${encodeURIComponent(result.uri)}`);
                    }}
                  >
                    <Icon name="docs" size={18} className="mr-2" />
                    <div className="flex-1">
                      <div className="font-medium">Blank Document</div>
                      <div className="text-xs text-muted-foreground">
                        Start from scratch
                      </div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={async () => {
                      setGenerateModalOpen(false);
                      isMobile && toggleSidebar();
                      const timestamp = new Date()
                        .toISOString()
                        .replace(/[:.]/g, "-");

                      const result = await upsertDocument.mutateAsync({
                        params: {
                          name: `AI App PRD - ${timestamp}`,
                          content: AI_APP_PRD_TEMPLATE,
                          description:
                            "Product Requirements Document for an AI-native application on decocms.com platform. This document helps plan tools, agents, workflows, views, and databases.",
                        },
                      });

                      const documentResource = {
                        integration_id: "i:documents-management",
                        name: "document",
                      };
                      const href =
                        buildResourceHrefFromResource(documentResource);
                      navigate(`${href}/${encodeURIComponent(result.uri)}`);
                    }}
                  >
                    <Icon name="rocket_launch" size={18} className="mr-2" />
                    <div className="flex-1">
                      <div className="font-medium">AI App PRD</div>
                      <div className="text-xs text-muted-foreground">
                        Plan tools, agents & workflows
                      </div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => {
                setGenerateModalOpen(false);
              }}
            >
              <div className="flex items-center gap-3 text-left">
                <Icon
                  name="flowchart"
                  size={24}
                  className="text-muted-foreground/75 mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-semibold">Workflow</div>
                  <div className="text-sm text-muted-foreground">
                    Create a new workflow
                  </div>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => {
                setGenerateModalOpen(false);
                isMobile && toggleSidebar();

                handleCreateAgent();
              }}
            >
              <div className="flex items-center gap-3 text-left">
                <Icon
                  name="robot_2"
                  size={24}
                  className="text-muted-foreground/75 mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-semibold">Agent</div>
                  <div className="text-sm text-muted-foreground">
                    Create an AI agent with specialized capabilities
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search Modal */}
      <SearchComingSoonModal
        open={_searchModalOpen}
        onOpenChange={_setSearchModalOpen}
      />

      {/* Files Modal */}
      <Dialog open={filesModalOpen} onOpenChange={setFilesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File System Access</DialogTitle>
            <DialogDescription>Coming soon to deco.cx</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30">
                <Icon name="folder_open" size={32} className="text-primary" />
              </div>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Direct file system access is coming soon. You'll be able to
                browse, edit, and manage your project files directly from the
                dashboard.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Browse project files</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Edit files in-browser</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Manage file structure</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Database Modal */}
      <Dialog open={databaseModalOpen} onOpenChange={setDatabaseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Database Management</DialogTitle>
            <DialogDescription>Coming soon to deco.cx</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30">
                <Icon name="storage" size={32} className="text-primary" />
              </div>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Database management tools are coming soon. Manage your data with
                a powerful interface.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Browse tables and collections</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Run queries and scripts</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Manage data relationships</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {addViewsDialogState.integration && (
        <AddViewsDialog
          integration={addViewsDialogState.integration}
          open={addViewsDialogState.open}
          onOpenChange={(open) =>
            setAddViewsDialogState({
              open,
              integration: open ? addViewsDialogState.integration : undefined,
            })
          }
        />
      )}
      <CommandPalette
        open={commandPalette.open}
        onOpenChange={(open) => {
          commandPalette.onOpenChange(open);
          if (!open) {
            setCommandPaletteInitialSearch("");
            setCommandPaletteInitialFilter(undefined);
          }
        }}
        initialSearch={commandPaletteInitialSearch}
        initialFilter={commandPaletteInitialFilter}
      />
    </>
  );
}

WorkspaceViews.Skeleton = () => (
  <div className="flex flex-col gap-0.5">
    {Array.from({ length: 20 }).map((_, index) => (
      <div key={index} className="w-full h-8">
        <Skeleton className="h-full bg-sidebar-accent rounded-md" />
      </div>
    ))}
  </div>
);

// Coming Soon menu items are now inline in the new sidebar structure

export function ProjectSidebar() {
  return (
    <Sidebar variant="sidebar">
      <SidebarContent className="flex-1 overflow-x-hidden">
        <SidebarGroup className="font-medium">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <Suspense fallback={<WorkspaceViews.Skeleton />}>
                <WorkspaceViews />
              </Suspense>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
