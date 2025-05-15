import {
  Thread,
  useAgents,
  useIntegrations,
  useMarketplaceIntegrations,
  useThreads,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { ReactNode, Suspense } from "react";
import { Link, useMatch } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/data/useUser.ts";
import { useWorkspaceLink } from "../../hooks/useNavigateWorkspace.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { groupThreadsByDate } from "../threads/index.tsx";
import { SidebarFooter } from "./footer.tsx";
import { Header as SidebarHeader } from "./header.tsx";

const STATIC_ITEMS = [
  {
    url: "/agents",
    title: "Agents",
    icon: "robot_2",
  },
  {
    url: "/integrations",
    title: "Integrations",
    icon: "widgets",
  },
  {
    url: "/triggers",
    title: "Triggers",
    icon: "conversion_path",
  },
  {
    url: "/audits",
    title: "Chat Logs",
    icon: "manage_search",
  },
];

const WithActive = (
  { children, ...props }: {
    to: string;
    children: (props: { isActive: boolean }) => ReactNode;
  },
) => {
  const match = useMatch(props.to);

  return (
    <div {...props}>
      {children({ isActive: !!match })}
    </div>
  );
};

function buildThreadUrl(thread: Thread): string {
  return `chat/${thread.metadata.agentId}/${thread.id}`;
}

function SidebarThreadList({ threads }: { threads: Thread[] }) {
  const { isMobile, toggleSidebar } = useSidebar();

  const handleThreadClick = (thread: Thread) => {
    trackEvent("sidebar_thread_click", {
      threadId: thread.id,
      threadTitle: thread.title,
      agentId: thread.metadata.agentId,
    });
    isMobile && toggleSidebar();
  };

  return threads.map((thread) => (
    <SidebarMenuItem key={thread.id}>
      <WithActive to={buildThreadUrl(thread)}>
        {({ isActive }) => (
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={thread.title}
            className="h-9"
          >
            <Link
              to={buildThreadUrl(thread)}
              onClick={() => handleThreadClick(thread)}
            >
              <span className="truncate">{thread.title}</span>
            </Link>
          </SidebarMenuButton>
        )}
      </WithActive>
    </SidebarMenuItem>
  ));
}

function SidebarThreadsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 20 }).map((_, index) => (
        <div key={index} className="w-full h-10 px-2">
          <Skeleton className="h-full bg-sidebar-accent rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function SidebarThreads() {
  const user = useUser();
  const { data } = useThreads(user?.id ?? "");
  const groupedThreads = groupThreadsByDate(data?.threads ?? []);

  return (
    <>
      {groupedThreads.today.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarGroupLabel>Today</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              <SidebarThreadList threads={groupedThreads.today} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {groupedThreads.yesterday.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarGroupLabel>Yesterday</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              <SidebarThreadList threads={groupedThreads.yesterday} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {Object.entries(groupedThreads.older).length > 0
        ? Object.entries(groupedThreads.older).map(([date, threads]) => {
          return (
            <SidebarGroup key={date}>
              <SidebarGroupContent>
                <SidebarGroupLabel>{date}</SidebarGroupLabel>
                <SidebarMenu className="gap-0.5">
                  <SidebarThreadList threads={threads} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })
        : null}
    </>
  );
}

function PrefetchIntegrations() {
  useIntegrations();
  useMarketplaceIntegrations();
  return null;
}

function PrefetchAgents() {
  useAgents();
  return null;
}

export function AppSidebar() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const workspaceLink = useWorkspaceLink();
  const focusChat = useFocusChat();

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader />

      <Suspense fallback={null}>
        <PrefetchIntegrations />
        <PrefetchAgents />
      </Suspense>

      <SidebarContent className="flex flex-col h-full overflow-x-hidden">
        <div className="flex flex-col h-full">
          <div className="flex-none">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="cursor-pointer"
                      onClick={() => {
                        focusChat(
                          WELL_KNOWN_AGENT_IDS.teamAgent,
                          crypto.randomUUID(),
                          { history: false },
                        );
                        isMobile && toggleSidebar();
                      }}
                    >
                      <Icon name="edit_square" size={16} />
                      <span className="truncate">New chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {STATIC_ITEMS.map((item) => {
                    const href = workspaceLink(item.url);

                    return (
                      <SidebarMenuItem key={item.title}>
                        <WithActive to={href}>
                          {({ isActive }) => (
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              tooltip={item.title}
                            >
                              <Link
                                to={href}
                                onClick={() => {
                                  trackEvent("sidebar_navigation_click", {
                                    item: item.title,
                                  });
                                  isMobile && toggleSidebar();
                                }}
                              >
                                <Icon name={item.icon} filled={isActive} />
                                <span className="truncate">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          )}
                        </WithActive>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>

          {!isCollapsed && (
            <>
              <SidebarSeparator />
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <Suspense fallback={<SidebarThreadsSkeleton />}>
                  <SidebarThreads />
                </Suspense>
              </div>
            </>
          )}

          <SidebarFooter />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
