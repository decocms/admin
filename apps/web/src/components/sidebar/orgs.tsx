import { WELL_KNOWN_AGENTS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
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
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense, useState } from "react";
import { useSearchParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useNavigateOrg } from "../../hooks/use-navigate-workspace.ts";
import { useThreadTitle } from "../decopilot/index.tsx";
import { useThread } from "../decopilot/thread-provider.tsx";
import {
  CommandPalette,
  useCommandPalette,
} from "../search/command-palette.tsx";
import { SidebarFooter } from "./footer.tsx";

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
  const { switchToThread, hideThread } = useThread();
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
  const { getAllThreads, activeThreadId } = useThread();
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

function OrgViews() {
  const navigateOrg = useNavigateOrg();

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/");
          }}
        >
          <Icon name="folder" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Projects</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/members");
          }}
        >
          <Icon name="group" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Members</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/billing");
          }}
        >
          <Icon name="wallet" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Billing</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/models");
          }}
        >
          <Icon
            name="network_intelligence"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Models</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/usage");
          }}
        >
          <Icon
            name="monitoring"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Usage</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/theme-editor");
          }}
        >
          <Icon name="palette" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Theme</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/settings");
          }}
        >
          <Icon
            name="settings"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Settings</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
}

OrgViews.Skeleton = () => (
  <div className="flex flex-col gap-0.5">
    {Array.from({ length: 20 }).map((_, index) => (
      <div key={index} className="w-full h-8">
        <Skeleton className="h-full bg-sidebar-accent rounded-md" />
      </div>
    ))}
  </div>
);

export function OrgsSidebar() {
  const { createThread } = useThread();
  const commandPalette = useCommandPalette();
  const [searchParams, setSearchParams] = useSearchParams();
  const [commandPaletteInitialSearch, setCommandPaletteInitialSearch] =
    useState("");
  const [commandPaletteInitialFilter, setCommandPaletteInitialFilter] =
    useState<"agent" | "app" | "document" | "thread" | undefined>();

  return (
    <Sidebar variant="sidebar">
      <SidebarContent className="flex-1 overflow-x-hidden">
        <SidebarGroup className="font-medium">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <Suspense fallback={<OrgViews.Skeleton />}>
                <OrgViews />
              </Suspense>

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
                        // Clear initialInput and autoSend params when creating a new thread
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete("initialInput");
                        newParams.delete("autoSend");
                        setSearchParams(newParams, { replace: true });
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
      <CommandPalette
        open={commandPalette.open}
        onOpenChange={(open) => {
          commandPalette.setOpen(open);
          if (!open) {
            setCommandPaletteInitialSearch("");
            setCommandPaletteInitialFilter(undefined);
          }
        }}
        initialSearch={commandPaletteInitialSearch}
        initialFilter={commandPaletteInitialFilter}
      />
    </Sidebar>
  );
}
