import { useAgents, useAllThreads, useIntegrations } from "@deco/sdk";
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
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { ReactNode, Suspense } from "react";
import { Link, useMatch } from "react-router";
import { useBasePath } from "../../hooks/useBasePath.ts";
import { groupThreadsByDate, Thread } from "../threads/index.tsx";
import { Header as SidebarHeader } from "./header.tsx";

const STATIC_ITEMS = [
  {
    url: "/",
    title: "New chat",
    icon: "forum",
  },
  {
    url: "/integrations",
    title: "Integrations",
    icon: "conversion_path",
  },
  {
    url: "/agents",
    title: "Agents",
    icon: "groups",
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
  return `agent/${thread.metadata.agentId}/${thread.id}`;
}

function SidebarThreadList({ threads }: { threads: Thread[] }) {
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
            <Link to={buildThreadUrl(thread)}>
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
  const { data: threads } = useAllThreads();
  const groupedThreads = groupThreadsByDate(threads);

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
  return null;
}

function PrefetchAgents() {
  useAgents();
  return null;
}

export function AppSidebar() {
  const withBasePath = useBasePath();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader />

      {/* Since the sidebar is rendered in the root layout, we prefetch common data here */}
      <Suspense fallback={null}>
        <PrefetchIntegrations />
        <PrefetchAgents />
      </Suspense>

      <SidebarContent className="flex flex-col h-full overflow-x-hidden">
        {/* Fixed section with static items */}
        <div className="flex-none overflow-x-hidden">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {STATIC_ITEMS.map((item) => {
                  const href = withBasePath(item.url);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <WithActive to={href}>
                        {({ isActive }) => (
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.title}
                            className="h-9"
                          >
                            <Link to={href}>
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
          <SidebarSeparator />
        </div>

        {/* Scrollable section with threads */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Suspense fallback={<SidebarThreadsSkeleton />}>
            <SidebarThreads />
          </Suspense>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
