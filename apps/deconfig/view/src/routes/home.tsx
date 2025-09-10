import { createRoute, type RootRoute } from "@tanstack/react-router";
import { BranchManager } from "../components/branch-manager";
import LoggedProvider from "@/components/logged-provider";

function HomePage() {
  return (
    <LoggedProvider>
      <div className="min-h-screen bg-gray-50">
        <BranchManager />
      </div>
    </LoggedProvider>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/",
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
