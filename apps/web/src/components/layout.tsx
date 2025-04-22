import { SDKProvider, Workspace } from "@deco/sdk";
import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { Outlet, useParams } from "react-router";
import { useUser } from "../hooks/data/useUser.ts";
import { AppSidebar } from "./sidebar/index.tsx";

export function Layout() {
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
        <AppSidebar />
        <SidebarInset className="h-full">
          <Outlet />
        </SidebarInset>
      </SDKProvider>
    </SidebarProvider>
  );
}
