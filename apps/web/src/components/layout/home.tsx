import { DecoQueryClientProvider } from "@deco/sdk";
import { Outlet } from "react-router";
import { OnboardingStateMachine } from "../onboarding/onboarding-state-machine";
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

function HomeLayoutContent() {
  return (
    <OnboardingStateMachine>
      <Outlet />
    </OnboardingStateMachine>
  );
}

export function HomeLayout() {
  return (
    <DecoQueryClientProvider>
      <HomeLayoutContent />
    </DecoQueryClientProvider>
  );
}
