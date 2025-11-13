import { DecoQueryClientProvider } from "@deco/sdk";
import { Outlet, useNavigate, useSearchParams } from "react-router";
import { Topbar } from "./topbar";
import { useEffect } from "react";
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

  useEffect(() => {
    // Check if we have initialInput in URL or stored onboarding params
    const hasInitialInput = searchParams.has("initialInput");
    const hasStoredParams = hasStoredOnboardingParams();

    if (hasInitialInput) {
      // User has initialInput params in URL, redirect to /new with params
      navigate(`/new?${searchParams.toString()}`, { replace: true });
    } else if (hasStoredParams) {
      // User has stored params in localStorage, restore and redirect to /new
      const storedParams = restoreOnboardingParams();
      if (storedParams) {
        const newSearchParams = onboardingParamsToSearchParams(storedParams);
        navigate(`/new?${newSearchParams.toString()}`, { replace: true });
      }
    }
  }, [searchParams, navigate]);

  return (
    <DecoQueryClientProvider>
      <Outlet />
    </DecoQueryClientProvider>
  );
}
