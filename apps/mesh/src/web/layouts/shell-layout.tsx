import { Outlet, useParams } from "@tanstack/react-router";
import { AppTopbar } from "@deco/ui/components/app-topbar.tsx";
import {
  SidebarInset,
  SidebarLayout,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import { SidebarToggleButton } from "@deco/ui/components/sidebar-toggle-button.tsx";
import RequiredAuthLayout from "@/web/layouts/required-auth-layout";
import { MeshUserMenu } from "@/web/components/user-menu";
import { authClient } from "@/web/lib/auth-client";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, Suspense } from "react";
import { SplashScreen } from "../components/splash-screen";
import { MeshSidebar } from "../components/org-sidebar";
import { MeshOrgSwitcher } from "../components/org-switcher";

function Topbar({
  showSidebarToggle = false,
  showOrgSwitcher = false,
}: {
  showSidebarToggle?: boolean;
  showOrgSwitcher?: boolean;
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
      <AppTopbar.Right>
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
  const { org: orgSlug } = useParams({ strict: false });

  const { mutate: setActiveOrg, isPending } = useMutation({
    mutationFn: async (organizationSlug: string) => {
      return await authClient.organization.setActive({
        organizationSlug,
      });
    },
    mutationKey: ["setActiveOrganization", orgSlug],
  });

  useEffect(() => {
    if (!orgSlug) return;
    setActiveOrg(orgSlug);
  }, [orgSlug, setActiveOrg]);

  return isPending && orgSlug ? fallback : children;
}

export default function ShellLayout() {
  const { org } = useParams({ strict: false });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const hasOrg = !!org;

  return (
    <RequiredAuthLayout>
      <OrgContextSetter fallback={<SplashScreen />}>
        {hasOrg ? (
          <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <div className="flex flex-col h-screen">
              <Topbar showSidebarToggle showOrgSwitcher />
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
                  <Outlet />
                </SidebarInset>
              </SidebarLayout>
            </div>
          </SidebarProvider>
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
