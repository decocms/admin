import { createRoot } from "react-dom/client";
import { StrictMode, Suspense } from "react";
import { Providers } from "@/web/providers/providers";
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { SplashScreen } from "@/web/components/splash-screen";
import * as z from "zod";

const rootRoute = createRootRoute({
  component: () => (
    <Providers>
      <Suspense fallback={<SplashScreen />}>
        <Outlet />
      </Suspense>
      <TanStackRouterDevtools />
    </Providers>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: lazyRouteComponent(() => import("./routes/login.tsx")),
  validateSearch: z.lazy(() => z.object({
    next: z.string().optional(),
  })),
});

/**
 * Better auth catchall
 */
const betterAuthRoutes = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/$pathname",
  component: lazyRouteComponent(() => import("./routes/auth-catchall.tsx")),
});

const requiredAuthLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "required-auth-layout",
  component: lazyRouteComponent(
    () => import("./layouts/required-auth-layout.tsx"),
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => requiredAuthLayout,
  path: "/",
  component: lazyRouteComponent(() => import("./routes/home.tsx")),
});

const requiredAuthRouteTree = requiredAuthLayout.addChildren([homeRoute]);

const routeTree = rootRoute.addChildren([
  requiredAuthRouteTree,
  loginRoute,
  betterAuthRoutes,
]);

const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
