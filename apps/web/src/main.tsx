import { useRuntime } from "@deco/sdk/hooks";
import { SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { lazy, ReactNode, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "./components/layout.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { GlobalStateProvider } from "./stores/global.tsx";

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

const AgentChat = lazy(
  () => import("./components/chat/index.tsx"),
);

const AgentEdit = lazy(
  () => import("./components/settings/index.tsx"),
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

function Router() {
  const { state: { context } } = useRuntime();

  return (
    <BrowserRouter basename={context?.root}>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={<Wrapper slot={<AgentChat agentId="teamAgent" />} />}
          />
          <Route
            path="agents"
            element={<Wrapper slot={<AgentsList />} />}
          />
          <Route
            path="agent/:id/settings"
            element={<Wrapper slot={<AgentEdit />} />}
          />
          <Route
            path="agent/:id/:threadId?"
            element={<Wrapper slot={<AgentChat />} />}
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
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
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
