import {
  DecoQueryClientProvider,
  useOnboardingAnswers,
  useOrganizations,
} from "@deco/sdk";
import { Spinner } from "@deco/ui/components/spinner.tsx";
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

  // Show single loading spinner while gathering all data
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Data is loaded - compute state
  const hasOrgs = teams.data.length > 0;
  const hasCompletedOnboarding = !!onboardingStatus.data?.completed;

  // Determine if onboarding dialog should be shown
  const shouldShowOnboarding = initialInput
    ? !hasOrgs // Show if user has initialInput but no orgs
    : !hasOrgs; // Show if user has no orgs

  // If user has initialInput and orgs, redirect to org selector
  if (initialInput && hasOrgs) {
    const params = new URLSearchParams(searchParams);
    location.href = `/onboarding/select-org?${params.toString()}`;
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
