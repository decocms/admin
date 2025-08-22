import { Suspense, useState } from "react";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { SDKProvider } from "@deco/sdk";
import { SidebarProvider, SidebarInset } from "@deco/ui/components/sidebar.tsx";
import { ProjectCard } from "./project-card.tsx";
import { useUserTeams } from "../sidebar/team-selector.tsx";
import { PageHeader } from "../common/page-header.tsx";
import { AppSidebar } from "../sidebar/index.tsx";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useUser } from "../../hooks/use-user.ts";
import { useLocation } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { 
  Component, 
  MessageCircle, 
  Users, 
  Receipt, 
  Activity, 
  AreaChart, 
  Settings, 
  Bot, 
  Notebook, 
  Wrench, 
  AppWindow, 
  Workflow,
  Plus
} from "lucide-react";

const PROJECT_COLORS = [
  "bg-amber-400",
  "bg-pink-500", 
  "bg-red-500",
  "bg-blue-500",
  "bg-emerald-800",
];

const PATTERN_COLORS = [
  "rgb(168, 85, 247)", // amber-400 bg → purple-500
  "rgb(252, 165, 165)", // pink-500 bg → red-300
  "rgb(252, 211, 77)", // red-500 bg → amber-300
  "rgb(196, 181, 253)", // blue-500 bg → violet-300
  "rgb(190, 242, 100)", // emerald-800 bg → lime-300
];

// Mock member data for projects
const generateMockMembers = (count: number) => {
  const mockMembers = [
    { id: "1", name: "John Doe", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=John" },
    { id: "2", name: "Jane Smith", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jane" },
    { id: "3", name: "Mike Johnson", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike" },
    { id: "4", name: "Sarah Wilson", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" },
    { id: "5", name: "Tom Brown", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tom" },
  ];
  
  return mockMembers.slice(0, Math.min(count, mockMembers.length));
};

function ProjectList() {
  const teams = useUserTeams();

  if (!teams?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
          <Component className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No projects yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Create your first project to start building with AI agents and tools.
        </p>
        <Button variant="special" size="sm" className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Create a project
        </Button>
      </div>
    );
  }

  // Transform teams data to match project card format
  const projects = teams.map((team, index) => ({
    id: team.id.toString(),
    name: team.label,
    slug: team.slug,
    description: `Project for ${team.label}`,
    avatarUrl: team.avatarUrl,
    backgroundColor: PROJECT_COLORS[index % PROJECT_COLORS.length],
    patternColor: PATTERN_COLORS[index % PATTERN_COLORS.length],
    members: generateMockMembers(Math.floor(Math.random() * 4) + 2), // 2-5 members
    memberCount: Math.floor(Math.random() * 25) + 2, // 2-26 total members
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          id={project.id}
          name={project.name}
          slug={project.slug}
          description={project.description}
          avatarUrl={project.avatarUrl}
          backgroundColor={project.backgroundColor}
          patternColor={project.patternColor}
          members={project.members}
          memberCount={project.memberCount}
        />
      ))}
    </div>
  );
}

function ProjectListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-muted rounded-xl overflow-hidden">
          <div className="p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <Skeleton className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
          <div className="h-12 border-t border-border flex items-center justify-between px-4">
            <div className="flex items-center -space-x-1">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="w-6 h-6 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrganizationLayout() {
  const user = useUser();
  const location = useLocation();
  const { value: defaultOpen, update: setDefaultOpen } = useLocalStorage({
    key: "deco-chat-sidebar",
    defaultValue: true,
  });
  const [open, setOpen] = useState(defaultOpen);

  const handleCreateProject = () => {
    console.log("Create project clicked");
  };

  const actionButtons = (
    <Button 
      onClick={handleCreateProject}
      variant="special" 
      size="default" 
      className="rounded-xl"
    >
      <Plus className="w-4 h-4 mr-2" />
      Create a project
    </Button>
  );

  // Organization-specific navigation items
  const organizationNavItems = [
    {
      to: "/organization",
      icon: Component,
      label: "Projects",
      isActive: location.pathname === "/organization",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Projects" }),
    },
    {
      to: "/organization/chat",
      icon: MessageCircle,
      label: "Chat",
      isActive: location.pathname.includes("/organization/chat"),
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Org Chat" }),
    },
    {
      to: "/organization/team",
      icon: Users,
      label: "Team",
      isActive: location.pathname.includes("/organization/team"),
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Team" }),
    },
    {
      to: "/organization/billing",
      icon: Receipt,
      label: "Billing",
      isActive: location.pathname.includes("/organization/billing"),
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Billing" }),
    },
    {
      to: "/organization/activity",
      icon: Activity,
      label: "Activity",
      isActive: location.pathname.includes("/organization/activity"),
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Activity" }),
    },
    {
      to: "/organization/usage",
      icon: AreaChart,
      label: "Usage",
      isActive: location.pathname.includes("/organization/usage"),
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Usage" }),
    },
    {
      to: "/organization/settings",
      icon: Settings,
      label: "Settings",
      isActive: location.pathname.includes("/organization/settings"),
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Org Settings" }),
    },
  ];

  // Organization-specific MCP items
  const organizationMcpItems = [
    {
      to: "/organization/agents",
      icon: Bot,
      label: "Agents",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Org Agents" }),
    },
    {
      to: "/organization/prompts",
      icon: Notebook,
      label: "Prompts",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Org Prompts" }),
    },
    {
      to: "/organization/tools",
      icon: Wrench,
      label: "Tools",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Org Tools" }),
    },
    {
      to: "/organization/views",
      icon: AppWindow,
      label: "Views",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Org Views" }),
    },
    {
      to: "/organization/workflows",
      icon: Workflow,
      label: "Workflows",
      onClick: () => trackEvent("sidebar_navigation_click", { item: "Org Workflows" }),
    },
  ];

  // Use the user's personal workspace instead of a fake one
  const workspace = user?.id ? `users/${user.id}` : "users/temp";

  return (
    <SDKProvider workspace={workspace}>
      <SidebarProvider
        open={open}
        onOpenChange={(open) => {
          setDefaultOpen(open);
          setOpen(open);
        }}
        className="h-full bg-background"
        style={
          {
            "--sidebar-width": "16rem",
            "--sidebar-width-mobile": "14rem",
          } as Record<string, string>
        }
      >
        <AppSidebar 
          customNavItems={organizationNavItems}
          customMcpItems={organizationMcpItems}
          showDefaultNav={false}
          showAppsSection={false}
        />
        <SidebarInset className="h-full flex-col bg-background">
          <div className="flex flex-col gap-2 p-1 w-full min-h-screen">
            <PageHeader
              title="Projects"
              icon="component"
              actionButtons={actionButtons}
            />
            <div className="flex-1 p-6">
              <Suspense fallback={<ProjectListSkeleton />}>
                <ProjectList />
              </Suspense>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SDKProvider>
  );
}