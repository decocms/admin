import { DecoQueryClientProvider } from "@deco/sdk";
import { Outlet } from "react-router";
import { Topbar } from "./topbar";

interface BreadcrumbItem {
  label: string | React.ReactNode;
  link?: string;
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
      <div className="pt-12 flex-1">{children}</div>
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
