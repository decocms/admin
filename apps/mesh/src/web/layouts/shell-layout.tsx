import { Outlet } from "@tanstack/react-router";
import { AppTopbar } from "@deco/ui/components/app-topbar.tsx";
import RequiredAuthLayout from "@/web/layouts/required-auth-layout";
import { MeshUserMenu } from "@/web/components/user-menu";

function Topbar() {
  return (
    <AppTopbar>
      <AppTopbar.Left>
        <h1 className="text-lg font-bold">MCP Mesh</h1>
      </AppTopbar.Left>
      <AppTopbar.Right>
        <MeshUserMenu />
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
