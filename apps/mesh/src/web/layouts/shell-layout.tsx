import { Outlet, useParams } from "@tanstack/react-router";
import { AppTopbar } from "@deco/ui/components/app-topbar.tsx";
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
import { DecoChatToggleButton } from "@deco/ui/components/deco-chat-toggle-button.tsx";
import RequiredAuthLayout from "@/web/layouts/required-auth-layout";
import { MeshUserMenu } from "@/web/components/user-menu";
import { authClient } from "@/web/lib/auth-client";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, Suspense } from "react";
import { SplashScreen } from "../components/splash-screen";
import { MeshSidebar } from "../components/mesh-sidebar";
import { MeshOrgSwitcher } from "../components/org-switcher";
import { ProjectContextProvider } from "../providers/project-context-provider";
import { Locator } from "../lib/locator";
import { useDecoChatOpen } from "../features/deco-chat/hooks/use-deco-chat-open";
import { DecoChatPanel } from "../features/deco-chat/components/deco-chat-panel";

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
          <DecoChatToggleButton
            onClick={onToggleChat}
            avatar={
              <span className="inline-flex size-5 items-center justify-center rounded-lg bg-lime-400 text-lime-950 shadow-sm">
                <span className="text-xs">🤖</span>
              </span>
            }
          />
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { open: chatOpen, toggle: toggleChat } = useDecoChatOpen();
  const hasOrg = !!org;

  return (
    <RequiredAuthLayout>
      <OrgContextSetter fallback={<SplashScreen />}>
        {hasOrg ? (
          // Should use "project ?? org-admin" when projects are introduced
          <ProjectContextProvider locator={Locator.adminProject(org)}>
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
          </ProjectContextProvider>
        ) : (
          <div className="min-h-screen bg-background">
            <Topbar onToggleChat={toggleChat} />
            <div className="pt-12">
              <Outlet />
            </div>
          </div>
        )}
      </OrgContextSetter>
    </RequiredAuthLayout>
  );
}
