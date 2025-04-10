import "./polyfills.ts";

import { WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { lazy, ReactNode, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { EmptyState } from "./components/common/EmptyState.tsx";
import { Layout } from "./components/layout.tsx";
import Login from "./components/login/index.tsx";
import { ErrorBoundary, useError } from "./ErrorBoundary.tsx";

const IntegrationNew = lazy(() =>
  import("./components/integrations/detail/new.tsx")
);

const IntegrationEdit = lazy(() =>
  import("./components/integrations/detail/edit.tsx")
);

const IntegrationMarketplace = lazy(() =>
  import("./components/integrations/list/marketplace.tsx")
);

const MyIntegrations = lazy(() =>
  import("./components/integrations/list/installed.tsx")
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
  const navigate = useNavigate();

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
      <h1>Not Found</h1>
      <p>The path {location.pathname} was not found.</p>
      <Button onClick={() => navigate("/")}>Go to Home</Button>
    </div>
  );
}

function ErrorFallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state: { error }, reset } = useError();
  const notLoggedIn = error?.name === "NotLoggedInError";

  useEffect(() => {
    if (!notLoggedIn) {
      return;
    }

    reset();

    const next = new URL(location.pathname, globalThis.location.origin);

    navigate(`/login?next=${next}`, { replace: true });
  }, [notLoggedIn, location.pathname, reset, navigate]);

  if (notLoggedIn) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <EmptyState
      icon="report"
      title="Something went wrong"
      description={error?.message ??
        "Looks like we are facing some technical issues. Please try again."}
      buttonProps={{
        onClick: () => reset(),
        children: "Retry",
      }}
    />
  );
}

function Router() {
  return (
    <Routes>
      <Route
        path="login"
        element={<Wrapper slot={<Login />} />}
      />

      <Route path="/:teamSlug?" element={<Layout />}>
        <Route
          index
          element={
            <Wrapper
              slot={<AgentDetail agentId={WELL_KNOWN_AGENT_IDS.teamAgent} />}
            />
          }
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
          path="integrations/marketplace"
          element={<Wrapper slot={<IntegrationMarketplace />} />}
        />
        <Route
          path="integrations"
          element={<Wrapper slot={<MyIntegrations />} />}
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

      <Route
        path="*"
        element={<Wrapper slot={<NotFound />} />}
      />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary fallback={<ErrorFallback />}>
        <Router />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
