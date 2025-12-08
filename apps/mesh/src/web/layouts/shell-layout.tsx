import { DecoChatPanel } from "@/web/components/deco-chat-panel";
import { ErrorBoundary } from "@/web/components/error-boundary";
import { MeshSidebar } from "@/web/components/mesh-sidebar";
import { MeshOrgSwitcher } from "@/web/components/org-switcher";
import { SplashScreen } from "@/web/components/splash-screen";
import { MeshUserMenu } from "@/web/components/user-menu";
import { useDecoChatOpen } from "@/web/hooks/use-deco-chat-open";
import { useLocalStorage } from "@/web/hooks/use-local-storage";
import RequiredAuthLayout from "@/web/layouts/required-auth-layout";
import { authClient } from "@/web/lib/auth-client";
import { LOCALSTORAGE_KEYS } from "@/web/lib/localstorage-keys";
import { Locator } from "@/web/lib/locator";
import { ChatProvider } from "@/web/providers/chat-provider";
import { ProjectContextProvider } from "@/web/providers/project-context-provider";
import { AppTopbar } from "@deco/ui/components/app-topbar.tsx";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { DecoChatSkeleton } from "@deco/ui/components/deco-chat-skeleton.tsx";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import { SidebarToggleButton } from "@deco/ui/components/sidebar-toggle-button.tsx";
import {
  SidebarInset,
  SidebarLayout,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useParams } from "@tanstack/react-router";
import { Suspense, useCallback } from "react";
import { KEYS } from "../lib/query-keys";

// Capybara avatar URL from decopilotAgent
const CAPYBARA_AVATAR_URL =
  "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png";

function Topbar({
  showSidebarToggle = false,
  showOrgSwitcher = false,
  showDecoChat = false,
  onToggleChat,
}: {
  showSidebarToggle?: boolean;
  showOrgSwitcher?: boolean;
  showDecoChat?: boolean;
  onToggleChat?: () => void;
}) {
  return (
    <AppTopbar>
      <AppTopbar.Left>
        {showSidebarToggle && <SidebarToggleButton />}
        {showOrgSwitcher && (
          <Suspense fallback={<MeshOrgSwitcher.Skeleton />}>
            <MeshOrgSwitcher />
          </Suspense>
        )}
      </AppTopbar.Left>
      <AppTopbar.Right className="gap-2">
        {showDecoChat && onToggleChat && (
          <Button size="sm" variant="default" onClick={onToggleChat}>
            <Avatar
              url={CAPYBARA_AVATAR_URL}
              fallback="DC"
              size="2xs"
              className="rounded-sm"
            />
            deco chat
          </Button>
        )}
        <MeshUserMenu />
      </AppTopbar.Right>
    </AppTopbar>
  );
}

function ShellLayoutContent() {
  const { org } = useParams({ strict: false });

  const [sidebarOpen, setSidebarOpen] = useLocalStorage(
    "mesh:sidebar-open",
    true,
  );
  const [chatOpen, setChatOpen] = useDecoChatOpen();

  const toggleChat = useCallback(
    () => setChatOpen((prev) => !prev),
    [setChatOpen],
  );

  const [chatPanelWidth, setChatPanelWidth] = useLocalStorage(
    LOCALSTORAGE_KEYS.decoChatPanelWidth(),
    30,
  );

  const { data: orgSlug } = useSuspenseQuery({
    queryKey: KEYS.activeOrganization(org),
    queryFn: async () => {
      await authClient.organization.setActive({ organizationSlug: org });
      return org ?? null;
    },
    gcTime: Infinity,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Should use "project ?? org-admin" when projects are introduced
  if (typeof orgSlug !== "string") {
    return (
      <div className="min-h-screen bg-background">
        <Topbar />
        <div className="pt-12">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <ProjectContextProvider locator={Locator.adminProject(orgSlug)}>
      <ChatProvider>
        <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <div className="flex flex-col h-screen">
            <Topbar
              showSidebarToggle
              showOrgSwitcher
              showDecoChat
              onToggleChat={toggleChat}
            />
            <SidebarLayout
              className="flex-1 bg-sidebar"
              style={
                {
                  "--sidebar-width": "13rem",
                  "--sidebar-width-mobile": "11rem",
                } as Record<string, string>
              }
            >
              <MeshSidebar />
              <SidebarInset className="pt-12">
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel className="bg-background">
                    <Outlet />
                  </ResizablePanel>
                  {chatOpen && (
                    <>
                      <ResizableHandle withHandle />
                      <ResizablePanel
                        defaultSize={chatPanelWidth}
                        minSize={20}
                        className="min-w-0"
                        onResize={setChatPanelWidth}
                      >
                        <ErrorBoundary>
                          <Suspense fallback={<DecoChatSkeleton />}>
                            <DecoChatPanel />
                          </Suspense>
                        </ErrorBoundary>
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              </SidebarInset>
            </SidebarLayout>
          </div>
        </SidebarProvider>
      </ChatProvider>
    </ProjectContextProvider>
  );
}

export default function ShellLayout() {
  return (
    <RequiredAuthLayout>
      <Suspense fallback={<SplashScreen />}>
        <ShellLayoutContent />
      </Suspense>
    </RequiredAuthLayout>
  );
}
