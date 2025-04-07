import { useRuntime } from "@deco/sdk/hooks";
import { SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { lazy, ReactNode, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { Layout } from "./components/layout.tsx";
import { ErrorBoundary, useError } from "./ErrorBoundary.tsx";
import { GlobalStateProvider } from "./stores/global.tsx";
import Login from "./components/login/index.tsx";

const IntegrationNew = lazy(() =>
  import("./components/integrations/detail/new.tsx")
);

const IntegrationEdit = lazy(() =>
  import("./components/integrations/detail/edit.tsx")
);

const IntegrationList = lazy(() =>
  import("./components/integrations/list/index.tsx")
);

const AgentsList = lazy(
  () => import("./components/agents/list.tsx"),
);

const AgentDetail = lazy(
  () => import("./components/agent/index.tsx"),
);

function Wrapper({ slot: children }: { slot: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function NotFound() {
  const location = useLocation();

  return (
    <div className="h-full w-full flex flex-col items-center justify-center">
      <h1>Not Found</h1>
      <p>The path {location.pathname} was not found.</p>
    </div>
  );
}

function ErrorFallback() {
  const result = useError();

  return (
    <div className="h-full w-full flex flex-col items-center justify-center">
      <h1>Error</h1>
      <p>{result.error?.message}</p>
    </div>
  );
}

function Router() {
  const { state: { context } } = useRuntime();
  const root = context?.root ?? "";
  const basename = root.startsWith("/") ? root.slice(1) : root;

  return (
    <BrowserRouter>
      <Routes>
        <Route path={basename} element={<Layout />}>
          <Route
            index
            element={<Wrapper slot={<AgentDetail agentId="teamAgent" />} />}
          />
          <Route
            path="agents"
            element={<Wrapper slot={<AgentsList />} />}
          />
          <Route
            path="agent/:id/:threadId?"
            element={<Wrapper slot={<AgentDetail />} />}
          />
          <Route
            path="integrations"
            element={<Wrapper slot={<IntegrationList />} />}
          />
          <Route
            path="integration/new"
            element={<Wrapper slot={<IntegrationNew />} />}
          />
          <Route
            path="integration/:id"
            element={<Wrapper slot={<IntegrationEdit />} />}
          />
        </Route>
        <Route index element={<Navigate to={basename} replace />} />
        <Route
          path="login"
          element={<Wrapper slot={<Login />} />}
        />
        <Route
          path="*"
          element={<Wrapper slot={<NotFound />} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary fallback={<ErrorFallback />}>
      <GlobalStateProvider>
        <SidebarProvider
          className="h-full"
          style={{
            "--sidebar-width": "14rem",
            "--sidebar-width-mobile": "14rem",
          } as Record<string, string>}
        >
          <Router />
        </SidebarProvider>
      </GlobalStateProvider>
    </ErrorBoundary>
  </StrictMode>,
);
