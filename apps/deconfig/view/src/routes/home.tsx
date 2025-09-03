import { createRoute, type RootRoute } from "@tanstack/react-router";
import { BranchManager } from "../components/branch-manager";

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BranchManager />
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/",
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
