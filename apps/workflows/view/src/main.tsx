import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import {
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import WorkflowsPage from "./routes/workflows.tsx";
import CustomViewsPage from "./routes/custom-views.tsx";
import AboutPage from "./routes/about.tsx";
import { Toaster } from "sonner";

// @ts-ignore - CSS import
import "./styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const routeTree = rootRoute.addChildren([
  WorkflowsPage,
  CustomViewsPage,
  AboutPage,
]);

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Force dark theme
document.documentElement.classList.add("dark");

const rootElement = document.getElementById("root");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  );
}
