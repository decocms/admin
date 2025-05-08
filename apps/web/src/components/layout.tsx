import { SDKProvider, Workspace } from "@deco/sdk";
import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { Outlet, useParams } from "react-router";
import { useUser } from "../hooks/data/useUser.ts";
import { AppSidebar } from "./sidebar/index.tsx";
import { SettingsSidebar } from "./sidebar/settings.tsx";

export const WorkspaceSettingsLayout = () => (
  <Layout sidebar={<SettingsSidebar />} />
);

export const Layout = ({ sidebar }: { sidebar?: React.ReactNode }) => {
  const { teamSlug } = useParams();
  const user = useUser();

  const rootContext: Workspace = teamSlug
    ? `shared/${teamSlug}`
    : `users/${user?.id}`;

  return (
    <SidebarProvider
      className="h-full bg-slate-50"
      style={{
        "--sidebar-width": "16rem",
        "--sidebar-width-mobile": "14rem",
      } as Record<string, string>}
    >
      <SDKProvider workspace={rootContext}>
        {sidebar ?? <AppSidebar />}
        <SidebarInset className="h-full p-2 bg-slate-50">
          <div className="h-full bg-background rounded-xl shadow-md overflow-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </SDKProvider>
    </SidebarProvider>
  );
};
