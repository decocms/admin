import "./polyfills.ts";

import { WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { JSX, lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { About } from "./components/about/index.tsx";
import { PageviewTracker } from "./components/analytics/PageviewTracker.tsx";
import { EmptyState } from "./components/common/EmptyState.tsx";
import { Layout } from "./components/layout.tsx";
import Login from "./components/login/index.tsx";
import { ErrorBoundary, useError } from "./ErrorBoundary.tsx";
import { trackException } from "./hooks/analytics.ts";

type LazyComp<P> = Promise<{
  default: React.ComponentType<P>;
}>;
const wrapWithUILoadingFallback = <P,>(
  lazyComp: LazyComp<P>,
): LazyComp<P> =>
  lazyComp.then(({ default: Comp }) => ({
    default: (p: P) => (
      <Suspense
        fallback={
          <div className="h-full w-full flex items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <Comp {...p as JSX.IntrinsicAttributes & P} />
      </Suspense>
    ),
  }));

/**
 * Route component with Suspense + Spinner. Remove the wrapWithUILoadingFallback if
 * want custom Suspense behavior.
 */
const IntegrationEdit = lazy(() =>
  wrapWithUILoadingFallback(import("./components/integrations/detail/edit.tsx"))
);

const IntegrationMarketplace = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/list/marketplace.tsx"),
  )
);

const MyIntegrations = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/list/installed.tsx"),
  )
);

const AgentsList = lazy(
  () => wrapWithUILoadingFallback(import("./components/agents/list.tsx")),
);

const Chat = lazy(
  () => wrapWithUILoadingFallback(import("./components/agent/chat.tsx")),
);

const EditAgent = lazy(
  () => wrapWithUILoadingFallback(import("./components/agent/edit.tsx")),
);

const Wallet = lazy(
  () => wrapWithUILoadingFallback(import("./components/wallet/index.tsx")),
);

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

    if (location.pathname === "/") {
      navigate("/about", { replace: true });
      return;
    }

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
      <Route path="login" element={<Login />} />

      <Route path="about" element={<About />} />

      <Route path="/:teamSlug?" element={<Layout />}>
        <Route
          index
          element={
            <Chat
              includeThreadTools
              agentId={WELL_KNOWN_AGENT_IDS.teamAgent}
              threadId={crypto.randomUUID()}
              disableThreadMessages
              key="disabled-messages"
            />
          }
        />
        <Route
          path="wallet"
          element={<Wallet />}
        />
        <Route
          path="agents"
          element={<AgentsList />}
        />
        <Route
          path="agent/:id/:threadId"
          element={<EditAgent />}
        />
        <Route
          path="chat/:id/:threadId"
          element={<Chat />}
        />
        <Route
          path="integrations/marketplace"
          element={<IntegrationMarketplace />}
        />
        <Route
          path="integrations"
          element={<MyIntegrations />}
        />
        <Route
          path="integration/:id"
          element={<IntegrationEdit />}
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary
        fallback={<ErrorFallback />}
        shouldCatch={(error) => {
          trackException(error);
          return true;
        }}
      >
        <PageviewTracker />
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <Router />
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
