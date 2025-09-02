import { createRoute, type RootRoute } from "@tanstack/react-router";

function HomePage() {
  return (
    <div className="bg-slate-900 min-h-screen flex items-center justify-center p-6">
      <h1 className="text-4xl font-bold text-white">Hello World</h1>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/",
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
