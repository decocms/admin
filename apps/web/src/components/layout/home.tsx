import { DecoQueryClientProvider } from "@deco/sdk";
import { Link, Outlet } from "react-router";
import { DefaultBreadcrumb } from "./project";
import { LoggedUser, LoggedUserAvatarTrigger } from "../sidebar/footer";
import { BreadcrumbSeparator } from "@deco/ui/components/breadcrumb.tsx";

interface BreadcrumbItem {
  label: string | React.ReactNode;
  link?: string;
}

function Topbar({ breadcrumb }: { breadcrumb: BreadcrumbItem[] }) {
  return (
    <div className="flex items-center justify-between w-screen p-4 h-13 border-b border-border">
      <div className="flex items-center gap-3">
        <Link to="/">
          <img
            src="/img/logo-tiny.svg"
            className="w-4 h-4 text-xs"
            alt="Deco Logo"
          />
        </Link>
        <BreadcrumbSeparator className="text-muted-foreground" />
        <DefaultBreadcrumb items={breadcrumb} useWorkspaceLink={false} />
      </div>
      <LoggedUser
        trigger={(user) => <LoggedUserAvatarTrigger user={user} />}
        disablePreferences
        align="end"
      />
    </div>
  );
}

export function TopbarLayout({
  children,
  breadcrumb,
}: {
  children: React.ReactNode;
  breadcrumb: BreadcrumbItem[];
}) {
  return (
    <div className="flex flex-col h-full">
      <Topbar breadcrumb={breadcrumb} />
      {children}
    </div>
  );
}

export function HomeLayout() {
  return (
    <DecoQueryClientProvider>
      <Outlet />
    </DecoQueryClientProvider>
  );
}
