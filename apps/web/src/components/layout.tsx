import { SDKProvider, Workspace } from "@deco/sdk";
import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { lazy, PropsWithChildren, ReactNode, Suspense } from "react";
import { createPortal } from "react-dom";
import { Outlet, useParams } from "react-router";
import { useUser } from "../hooks/data/useUser.ts";
import Docked, { Tab } from "./dock/index.tsx";
import { AppSidebar } from "./sidebar/index.tsx";

const RegisterActivity = lazy(() => import("./common/RegisterActivity.tsx"));

export function HeaderSlot({
  position,
  children,
}: PropsWithChildren<{ position: "start" | "end" }>) {
  const targetElement = document.getElementById(`chat-header-${position}-slot`);

  if (!targetElement) {
    return null;
  }

  return createPortal(children, targetElement);
}

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
        <Suspense fallback={null}>
          <RegisterActivity teamSlug={teamSlug} />
        </Suspense>
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
