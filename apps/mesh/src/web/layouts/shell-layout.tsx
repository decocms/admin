import { Outlet, useParams } from "@tanstack/react-router";
import { AppTopbar } from "@deco/ui/components/app-topbar.tsx";
import RequiredAuthLayout from "@/web/layouts/required-auth-layout";
import { MeshUserMenu } from "@/web/components/user-menu";
import { authClient } from "@/web/lib/auth-client";
import { useEffect, useState } from "react";
import { SplashScreen } from "../components/splash-screen";

function Topbar() {
  return (
    <AppTopbar>
      <AppTopbar.Left>
        <></>
      </AppTopbar.Left>
      <AppTopbar.Right>
        <MeshUserMenu />
      </AppTopbar.Right>
    </AppTopbar>
  );
}

function OrgContextSetter({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const { org: orgSlug } = useParams({ strict: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgSlug) return;
    setIsLoading(true);
    authClient.organization
      .setActive({
        organizationSlug: orgSlug,
      })
      .finally(() => setIsLoading(false));
  }, [orgSlug]);

  return isLoading && orgSlug ? fallback : children;
}

export default function ShellLayout() {
  return (
    <RequiredAuthLayout>
      <OrgContextSetter fallback={<SplashScreen />}>
        <div className="min-h-screen bg-background">
          <Topbar />
          <div className="pt-12">
            <Outlet />
          </div>
        </div>
      </OrgContextSetter>
    </RequiredAuthLayout>
  );
}
