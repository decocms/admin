import { SDKProvider } from "@deco/sdk";
import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Outlet, useLocation, useMatch, useParams } from "react-router";
import { useUser } from "../hooks/data/useUser.ts";
import { AppSidebar } from "./sidebar/index.tsx";

export function Layout() {
  const { teamSlug } = useParams();
  const location = useLocation();
  const user = useUser();

  const rootContext = teamSlug ? `shared/${teamSlug}` : `users/${user?.id}`;
  const isAgentDetail = useMatch("/:teamSlug?/agent/:id/:threadId?") ||
    location.pathname === "/" || location.pathname === `/${teamSlug}`;

  return (
    <SidebarProvider
      className="h-full"
      style={{
        "--sidebar-width": "14rem",
        "--sidebar-width-mobile": "14rem",
      } as Record<string, string>}
    >
      <SDKProvider context={rootContext}>
        <AppSidebar />
        <SidebarInset
          className={cn(
            "h-full",
            !isAgentDetail && "px-4 py-2",
          )}
        >
          <Outlet />
        </SidebarInset>
      </SDKProvider>
    </SidebarProvider>
  );
}
