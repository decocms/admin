import { createRoute, type RootRoute } from "@tanstack/react-router";
import { NamespaceManager } from "../components/namespace-manager";

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NamespaceManager />
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/",
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
