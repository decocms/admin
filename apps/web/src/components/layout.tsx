import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { Outlet } from "react-router";
import { GlobalStateProvider } from "../stores/global.tsx";
import { AppSidebar } from "./sidebar/index.tsx";
import { Topbar } from "./topbar/index.tsx";

export function Layout() {
  return (
    <SidebarProvider
      className="h-full"
      style={{
        "--sidebar-width": "14rem",
        "--sidebar-width-mobile": "14rem",
      } as Record<string, string>}
    >
      <GlobalStateProvider>
        <AppSidebar />
        <SidebarInset className="px-4 py-2 h-full flex flex-col gap-4">
          <Topbar />
          <Outlet />
        </SidebarInset>
      </GlobalStateProvider>
    </SidebarProvider>
  );
}
