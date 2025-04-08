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
import { ReactNode } from "react";
import { Link, useMatch } from "react-router";
import { useBasePath } from "../../hooks/useBasePath.ts";
import { useGlobalState } from "../../stores/global.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { SidebarFooter } from "./footer.tsx";
import { Header as SidebarHeader } from "./header.tsx";
import { useAgents, useAllThreads, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { groupThreadsByDate, Thread } from "../threads/index.tsx";

const STATIC_ITEMS = [
  {
    url: "/",
    title: "Chat",
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

function extractThreadId(obj: { id: string }): string | null {
  const parts = obj.id.split("-");
  if (parts.length < 5) return null;
  // Take the last 5 parts to reconstruct the UUID
  const threadId = parts.slice(-5).join("-");
  return threadId;
}

function extractAgentId(obj: { resourceId: string }): string | null {
  const match = obj.resourceId.match(/agents([0-9a-f]{32})/i);
  if (!match) {
    // check for well known agent ids
    const wellKnownIdMatch = obj.resourceId.match(/agents([^-]+)/);
    const wellKnownId = wellKnownIdMatch ? wellKnownIdMatch[1] : null;
    if (wellKnownId === WELL_KNOWN_AGENT_IDS.teamAgent.toLowerCase()) {
      return WELL_KNOWN_AGENT_IDS.teamAgent;
    }

    return null;
  }
  const raw = match[1];
  // Insert hyphens to format as UUID
  const formatted = [
    raw.slice(0, 8),
    raw.slice(8, 12),
    raw.slice(12, 16),
    raw.slice(16, 20),
    raw.slice(20),
  ].join("-");
  return formatted;
}

// TODO(@camudo): please change this later to get agent and thread id from metadata
// so i dont have to do this weird stuff
function buildThreadUrl(thread: Thread): string {
  const agentId = extractAgentId(thread);
  const threadId = extractThreadId(thread);
  return `/agent/${agentId}/${threadId}`;
}

function SidebarThreadList({ threads }: { threads: Thread[] }) {
  return threads.map((thread) => {
    return (
      <SidebarMenuItem key={thread.id} onClick={() => console.log(thread)}>
        <WithActive to={buildThreadUrl(thread)}>
          {({ isActive }) => (
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={thread.title}
            >
              <Link to={buildThreadUrl(thread)}>
                <span>{thread.title}</span>
              </Link>
            </SidebarMenuButton>
          )}
        </WithActive>
      </SidebarMenuItem>
    );
  });
}

export function AppSidebar() {
  const { data: threads } = useAllThreads();
  const { data: agents } = useAgents();
  const threadsExcludingDeletedAgents = threads.filter((thread: any) => {
    const agentId = extractAgentId(thread);
    return agentId && agents.some((agent) => agent.id === agentId);
  });
  const groupedThreads = groupThreadsByDate(threadsExcludingDeletedAgents);
  const withBasePath = useBasePath();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
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
                        >
                          <Link to={href}>
                            <Icon name={item.icon} filled={isActive} />
                            <span>{item.title}</span>
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

        {groupedThreads.today.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarGroupLabel>Today</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarThreadList threads={groupedThreads.today} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {groupedThreads.yesterday.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarGroupLabel>Yesterday</SidebarGroupLabel>
              <SidebarMenu>
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
                  <SidebarMenu>
                    <SidebarThreadList threads={threads} />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })
          : null}
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  );
}
