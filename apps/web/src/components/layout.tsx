import { SDKProvider, Workspace } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { ReactNode } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import { useUser } from "../hooks/data/useUser.ts";
import RegisterActivity from "./common/RegisterActivity.tsx";
import Docked, { Tab } from "./dock/index.tsx";
import { AppSidebar } from "./sidebar/index.tsx";

export function RouteLayout() {
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
        <AppSidebar />
        <SidebarInset className="h-full flex-col p-2 bg-slate-50">
          <Outlet />
        </SidebarInset>
        <RegisterActivity teamSlug={teamSlug} />
      </SDKProvider>
    </SidebarProvider>
  );
}

export interface PageLayoutProps {
  breadcrumb?: ReactNode;
  actionButtons?: ReactNode;
  tabs: Record<string, Tab>;
  displayViewsTrigger?: boolean;
}

export function PageLayout({
  breadcrumb,
  actionButtons,
  tabs,
  displayViewsTrigger = true,
}: PageLayoutProps) {
  return (
    <Docked.Provider tabs={tabs}>
      <div className="bg-slate-50 flex items-center justify-between">
        <div
          id="chat-header-start-slot"
          className="px-1 pt-1 pb-3 min-h-14 empty:min-h-0 empty:p-0 flex items-center gap-2"
        >
          {breadcrumb}
        </div>
        <div
          id="chat-header-end-slot"
          className="px-1 pt-1 pb-3 min-h-14 empty:min-h-0 empty:p-0 flex items-center gap-2"
        >
          {actionButtons}
          {displayViewsTrigger && <Docked.ViewsTrigger />}
        </div>
      </div>
      <div className="h-full">
        <Docked tabs={tabs} />
      </div>
    </Docked.Provider>
  );
}

export function DefaultBreadcrumb({ icon, list, item }: {
  icon: string;
  list: string;
  item?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3">
      {item && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <Icon name="arrow_back" />
        </Button>
      )}
      <Icon name={icon} size={16} className="text-slate-700" filled />
      <span className="text-slate-700 text-nowrap">{list}</span>
      {item && <span className="text-sm text-slate-500">/</span>}
      {item && (
        <span className="text-sm text-slate-500 truncate max-w-50">{item}</span>
      )}
    </div>
  );
}
