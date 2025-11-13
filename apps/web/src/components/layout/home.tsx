import { DecoQueryClientProvider } from "@deco/sdk";
import { Outlet, useNavigate, useSearchParams } from "react-router";
import { Topbar } from "./topbar";
import { useEffect, useMemo } from "react";
import {
  hasStoredOnboardingParams,
  restoreOnboardingParams,
  onboardingParamsToSearchParams,
} from "../../utils/onboarding-storage.ts";

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Synchronously determine if we should navigate to /new
  const shouldNavigate = useMemo(() => {
    const hasInitialInput = searchParams.has("initialInput");
    const hasStoredParams = hasStoredOnboardingParams();

    if (hasInitialInput) {
      return { to: `/new?${searchParams.toString()}` };
    }

    if (hasStoredParams) {
      const storedParams = restoreOnboardingParams();
      if (storedParams) {
        const newSearchParams = onboardingParamsToSearchParams(storedParams);
        return { to: `/new?${newSearchParams.toString()}` };
      }
    }

    return null;
  }, [searchParams]);

  // Perform navigation in useEffect
  useEffect(() => {
    if (shouldNavigate) {
      navigate(shouldNavigate.to, { replace: true });
    }
  }, [shouldNavigate, navigate]);

  // Don't render Outlet if we're navigating away
  if (shouldNavigate) {
    return null;
  }

  return (
    <DecoQueryClientProvider>
      <Outlet />
    </DecoQueryClientProvider>
  );
}
