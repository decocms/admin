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

  // Fetch both data sources
  const teams = useOrganizations({});
  const onboardingStatus = useOnboardingAnswers();

  // Wait for ALL data to load before deciding what to show
  const isLoading = !teams.data || onboardingStatus.isLoading;

  const hasOrgs = teams.data && teams.data.length > 0;
  const hasCompletedOnboarding = !!onboardingStatus.data?.completed;
  const shouldShowOnboarding = !hasOrgs; // Show if user has no orgs

  // Redirect to org selector when user has orgs
  useEffect(() => {
    if (isLoading || !hasOrgs || !hasCompletedOnboarding || !initialInput) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    const url = new URL("/onboarding/select-org", globalThis.location.origin);
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    location.href = url.href;
  }, [isLoading, hasOrgs, hasCompletedOnboarding, searchParams]);

  // Show single loading spinner while gathering all data or while redirect effect runs
  if (isLoading || hasOrgs) {
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
