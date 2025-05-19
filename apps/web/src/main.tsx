import "./polyfills.ts";

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

import { EmptyState } from "./components/common/EmptyState.tsx";
import { ErrorBoundary, useError } from "./ErrorBoundary.tsx";

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

const RouteLayout = lazy(() =>
  import("./components/layout.tsx").then((mod) => ({
    default: mod.RouteLayout,
  }))
);
const Login = lazy(() => import("./components/login/index.tsx"));
const About = lazy(() => import("./components/about/index.tsx"));
const PageviewTracker = lazy(() =>
  import("./components/analytics/PageviewTracker.tsx").then((mod) => ({
    default: mod.PageviewTracker,
  }))
);

/**
 * Route component with Suspense + Spinner. Remove the wrapWithUILoadingFallback if
 * want custom Suspense behavior.
 */
const IntegrationDetail = lazy(() =>
  wrapWithUILoadingFallback(import("./components/integrations/detail/edit.tsx"))
);

const IntegrationList = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/list/installed.tsx"),
  )
);

const IntegrationMarketplace = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/list/marketplace.tsx"),
  )
);

const AgentList = lazy(
  () => wrapWithUILoadingFallback(import("./components/agents/list.tsx")),
);

const AgentDetail = lazy(
  () => wrapWithUILoadingFallback(import("./components/agent/edit.tsx")),
);

const Chat = lazy(
  () => wrapWithUILoadingFallback(import("./components/agent/chat.tsx")),
);

const PublicChats = lazy(
  () => wrapWithUILoadingFallback(import("./components/agent/chats.tsx")),
);

const AuditList = lazy(
  () => wrapWithUILoadingFallback(import("./components/audit/list.tsx")),
);

const AuditDetail = lazy(
  () => wrapWithUILoadingFallback(import("./components/audit/detail.tsx")),
);

const MagicLink = lazy(() =>
  wrapWithUILoadingFallback(import("./components/login/magicLink.tsx"))
);

const Settings = lazy(() =>
  wrapWithUILoadingFallback(import("./components/settings/page.tsx"))
);

const TriggerList = lazy(() =>
  wrapWithUILoadingFallback(import("./components/triggers/list.tsx"))
);

const TriggerDetails = lazy(() =>
  wrapWithUILoadingFallback(import("./components/triggers/triggerDetails.tsx"))
);

const InvitesList = lazy(() =>
  wrapWithUILoadingFallback(import("./components/invites/index.tsx"))
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
        onClick: () => globalThis.location.reload(),
        children: "Retry",
      }}
    />
  );
}

function Router() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="login/magiclink" element={<MagicLink />} />

      <Route path="about" element={<About />} />

      <Route path="invites" element={<RouteLayout />}>
        <Route index element={<InvitesList />} />
      </Route>

      <Route
        path="chats"
        element={<PublicChats />}
      />

      <Route path="/:teamSlug?" element={<RouteLayout />}>
        <Route
          index
          element={
            <Chat
              showThreadMessages={false}
              agentId="teamAgent"
              threadId={crypto.randomUUID()}
              key="disabled-messages"
            />
          }
        />

        <Route
          path="agents"
          element={<AgentList />}
        />
        <Route
          path="agent/:id/:threadId"
          element={<AgentDetail />}
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
          element={<IntegrationList />}
        />
        <Route
          path="integration/:id"
          element={<IntegrationDetail />}
        />
        <Route
          path="triggers"
          element={<TriggerList />}
        />
        <Route
          path="trigger/:agentId/:triggerId"
          element={<TriggerDetails />}
        />
        <Route
          path="settings"
          element={<Settings />}
        />
        <Route
          path="audits"
          element={<AuditList />}
        />
        <Route
          path="audit/:id"
          element={<AuditDetail />}
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
          import("./hooks/analytics.ts").then((mod) =>
            mod.trackException(error)
          );

          return true;
        }}
      >
        <Suspense fallback={null}>
          <PageviewTracker />
        </Suspense>
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
