import { OrganizationSwitcher, UserButton } from "@daveyplate/better-auth-ui";
import { Outlet, useParams } from "@tanstack/react-router";
import RequiredAuthLayout from "@/web/layouts/required-auth-layout";

function Topbar() {
  const { org: orgSlug } = useParams({ strict: false });

  return (
    <div className="h-12 bg-background border-b border-border sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-1 flex items-center justify-between">
        <h1 className="text-lg font-bold">Decocms Mesh</h1>
        <div className="flex items-center gap-4">
          <UserButton className="h-9" />
          <OrganizationSwitcher className="h-9" slug={orgSlug} />
        </div>
      </div>
    </div>
  );
}

export default function ShellLayout() {
  return (
    <RequiredAuthLayout>
      <div className="min-h-screen bg-background">
        <Topbar />
        <Outlet />
      </div>
    </RequiredAuthLayout>
  );
}
