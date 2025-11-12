import { OrganizationSwitcher, UserButton } from "@daveyplate/better-auth-ui";
import { Outlet, useParams } from "@tanstack/react-router";
import { AppTopbar } from "@deco/ui/components/app-topbar.tsx";
import RequiredAuthLayout from "@/web/layouts/required-auth-layout";

function Topbar() {
  const { org: orgSlug } = useParams({ strict: false });

  return (
    <AppTopbar>
      <AppTopbar.Left>
        <h1 className="text-lg font-bold">MCP Mesh</h1>
      </AppTopbar.Left>
      <AppTopbar.Right>
        <UserButton className="h-9" />
        <OrganizationSwitcher className="h-9" slug={orgSlug} />
      </AppTopbar.Right>
    </AppTopbar>
  );
}

export default function ShellLayout() {
  return (
    <RequiredAuthLayout>
      <div className="min-h-screen bg-background">
        <Topbar />
        <div className="pt-12">
          <Outlet />
        </div>
      </div>
    </RequiredAuthLayout>
  );
}
