import { SDKProvider, Workspace } from "@deco/sdk";
import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { Outlet, useParams } from "react-router";
import { lazy, Suspense } from "react";
import { useUser } from "../hooks/data/useUser.ts";
import { AppSidebar } from "./sidebar/index.tsx";
import { SettingsSidebar } from "./sidebar/settings.tsx";
const RegisterActivity = lazy(() => import("./common/RegisterActivity.tsx"));

function BaseLayout({
  sidebar,
}: {
  sidebar: React.ReactNode;
}) {
  const { teamSlug } = useParams();
  const user = useUser();

  const rootContext: Workspace = teamSlug
    ? `shared/${teamSlug}`
    : `users/${user?.id}`;

  return (
    <SidebarProvider
      className="h-full"
      style={{
        "--sidebar-width": "16rem",
        "--sidebar-width-mobile": "14rem",
      } as Record<string, string>}
    >
      <SDKProvider workspace={rootContext}>
        {sidebar}
        <SidebarInset className="h-full">
          <Outlet />
        </SidebarInset>
        <Suspense fallback={null}>
          <RegisterActivity teamSlug={teamSlug} />
        </Suspense>
      </SDKProvider>
    </SidebarProvider>
  );
}

export const WorkspaceLayout = () => <BaseLayout sidebar={<AppSidebar />} />;
export const WorkspaceSettingsLayout = () => (
  <BaseLayout sidebar={<SettingsSidebar />} />
);
