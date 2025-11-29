import { Outlet, useParams } from "@tanstack/react-router";
import { AppTopbar } from "@deco/ui/components/app-topbar.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import {
  SidebarInset,
  SidebarLayout,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import { SidebarToggleButton } from "@deco/ui/components/sidebar-toggle-button.tsx";
import RequiredAuthLayout from "@/web/layouts/required-auth-layout";
import { MeshUserMenu } from "@/web/components/user-menu";
import { authClient } from "@/web/lib/auth-client";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, Suspense, useCallback } from "react";
import { SplashScreen } from "@/web/components/splash-screen";
import { MeshSidebar } from "@/web/components/mesh-sidebar";
import { MeshOrgSwitcher } from "@/web/components/org-switcher";
import { ProjectContextProvider } from "@/web/providers/project-context-provider";
import { Locator } from "@/web/lib/locator";
import { useDecoChatOpen } from "@/web/hooks/use-deco-chat-open";
import { DecoChatPanel } from "@/web/components/deco-chat-panel";
import { LocalStorageChatThreadsProvider } from "@/web/providers/localstorage-chat-threads-provider";
import { useLocalStorage } from "@/web/hooks/use-local-storage";

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
      <AppTopbar.Right className="gap-3">
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

function OrgContextSetter({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const { org } = useParams({ strict: false });
  const [isReady, setIsReady] = useState(false);

  const setOrgMutation = useMutation({
    mutationFn: async (orgSlug: string) => {
      await authClient.organization.setActive({ organizationSlug: orgSlug });
    },
  });

  useEffect(() => {
    if (!org) {
      setIsReady(true);
      return;
    }

    setOrgMutation.mutate(org, {
      onSettled: () => setIsReady(true),
    });
  }, [org]);

  if (!isReady) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default function ShellLayout() {
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
  const hasOrg = !!org;

  return (
    <RequiredAuthLayout>
      <OrgContextSetter fallback={<SplashScreen />}>
        {hasOrg ? (
          // Should use "project ?? org-admin" when projects are introduced
          <ProjectContextProvider locator={Locator.adminProject(org)}>
            <LocalStorageChatThreadsProvider>
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
                              defaultSize={30}
                              minSize={20}
                              className="min-w-0"
                            >
                              <Suspense fallback={<div>Loading chat...</div>}>
                                <DecoChatPanel />
                              </Suspense>
                            </ResizablePanel>
                          </>
                        )}
                      </ResizablePanelGroup>
                    </SidebarInset>
                  </SidebarLayout>
                </div>
              </SidebarProvider>
            </LocalStorageChatThreadsProvider>
          </ProjectContextProvider>
        ) : (
          <div className="min-h-screen bg-background">
            <Topbar />
            <div className="pt-12">
              <Outlet />
            </div>
          </div>
        )}
      </OrgContextSetter>
    </RequiredAuthLayout>
  );
}
