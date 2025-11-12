import {
  DecoQueryClientProvider,
  useOnboardingAnswers,
  useOrganizations,
} from "@deco/sdk";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useEffect } from "react";
import { Outlet, useSearchParams } from "react-router";
import { OnboardingDialog } from "../onboarding/onboarding-dialog";
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
  const [searchParams] = useSearchParams();
  const initialInput = searchParams.get("initialInput");

  const teams = useOrganizations({});
  const onboardingStatus = useOnboardingAnswers();

  const hasOrgs = teams.data.length > 0;
  const hasCompletedOnboarding = !!onboardingStatus.data?.completed;
  const shouldShowOnboarding = !hasOrgs;
  const shouldRedirect = hasOrgs && Boolean(initialInput);

  useEffect(() => {
    if (!shouldRedirect) return;

    const url = new URL("/onboarding/select-org", globalThis.location.origin);
    searchParams.forEach((value, key) => url.searchParams.set(key, value));
    location.href = url.href;
  }, [shouldRedirect, searchParams]);

  // Brief spinner while redirect effect runs to avoid UI flash
  if (shouldRedirect) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      {shouldShowOnboarding && (
        <OnboardingDialog hasCompletedOnboarding={hasCompletedOnboarding} />
      )}
      <Outlet />
    </>
  );
}

export function HomeLayout() {
  return (
    <DecoQueryClientProvider>
      <HomeLayoutContent />
    </DecoQueryClientProvider>
  );
}
