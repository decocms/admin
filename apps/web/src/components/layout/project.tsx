import { Locator, SDKProvider, WELL_KNOWN_AGENTS } from "@deco/sdk";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@deco/ui/components/breadcrumb.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import {
  SidebarInset,
  SidebarLayout,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import { Toaster } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { Fragment, Suspense, type ReactNode } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useProjectDocumentTitle } from "../../hooks/use-project-document-title.ts";
import { useUser } from "../../hooks/use-user.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import RegisterActivity from "../common/register-activity.tsx";
import { DecopilotChatProviderWrapper } from "../decopilot/decopilot-chat-provider-wrapper.tsx";
import { ThreadProvider } from "../decopilot/thread-provider.tsx";
import { DecopilotThreadProvider } from "../decopilot/thread-context.tsx";
import { ProfileModalProvider, useProfileModal } from "../profile-modal.tsx";
import { ProjectSidebar } from "../sidebar/index.tsx";
import { WithOrgTheme } from "../theme.tsx";
import { useDecopilotOpen } from "./decopilot-layout.tsx";
import { TopbarLayout } from "./home.tsx";
import { BreadcrumbOrgSwitcher } from "./org-project-switcher.tsx";
import { BreadcrumbProjectSwitcher } from "./project-switcher.tsx";

export function BaseRouteLayout({ children }: { children: ReactNode }) {
  // remove?
  useUser();
  const { org, project } = useParams();

  if (!org || !project) {
    throw new Error("No organization or project found");
  }

  return (
    <SDKProvider locator={Locator.from({ org, project })}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "max-w-sm text-sm",
          style: {
            padding: "12px 16px",
          },
        }}
      />
    </SDKProvider>
  );
}

function ProjectDocumentTitleUpdater() {
  useProjectDocumentTitle();
  return null;
}

export function ProjectLayout() {
  return (
    <BaseRouteLayout>
      <WithOrgTheme>
        <ThreadProvider>
          <ProjectLayoutContent />
        </ThreadProvider>
      </WithOrgTheme>
    </BaseRouteLayout>
  );
}

function ProjectLayoutContent() {
  const { org, project } = useParams();

  const [sidebarOpen, setSidebarOpen] = useLocalStorage<boolean>(
    "deco-chat-sidebar",
    (existing) => Boolean(existing ?? true),
  );

  const {
    profileOpen,
    setProfileOpen,
    openProfileModal,
    closeProfileModal,
    handlePhoneSaved,
  } = useProfileModal();

  return (
    <>
      <ProjectDocumentTitleUpdater />
      <DecopilotThreadProvider>
        <DecopilotChatProviderWrapper forceBottomLayout={!project}>
          <ProfileModalProvider
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            openProfileModal={openProfileModal}
            closeProfileModal={closeProfileModal}
            handlePhoneSaved={handlePhoneSaved}
          >
            <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <div className="flex flex-col h-full">
                <TopbarLayout
                  breadcrumb={[
                    {
                      label: (
                        <Suspense fallback={<BreadcrumbOrgSwitcher.Skeleton />}>
                          <BreadcrumbOrgSwitcher />
                        </Suspense>
                      ),
                    },
                    {
                      label: (
                        <Suspense
                          fallback={<BreadcrumbProjectSwitcher.Skeleton />}
                        >
                          <BreadcrumbProjectSwitcher />
                        </Suspense>
                      ),
                      link: `/${org}/${project}`,
                    },
                  ]}
                >
                  <SidebarLayout
                    className="h-full bg-sidebar"
                    style={
                      {
                        "--sidebar-width": "13rem",
                        "--sidebar-width-mobile": "11rem",
                      } as Record<string, string>
                    }
                  >
                    <ProjectSidebar />
                    <SidebarInset className="h-[calc(100vh-48px)] flex-col bg-sidebar">
                      <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel className="bg-background">
                          <Suspense
                            fallback={
                              <div className="h-[calc(100vh-48px)] w-full grid place-items-center">
                                <Spinner />
                              </div>
                            }
                          >
                            <Outlet />
                          </Suspense>
                        </ResizablePanel>
                      </ResizablePanelGroup>
                    </SidebarInset>
                  </SidebarLayout>
                </TopbarLayout>
                <RegisterActivity orgSlug={org} projectSlug={project} />
              </div>
            </SidebarProvider>
          </ProfileModalProvider>
        </DecopilotChatProviderWrapper>
      </DecopilotThreadProvider>
    </>
  );
}

export const ToggleDecopilotButton = () => {
  const { toggle } = useDecopilotOpen();

  return (
    <Button size="sm" variant="default" onClick={toggle}>
      <AgentAvatar
        className="rounded-sm border-none"
        url={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
        fallback={
          <img src="/img/logo-tiny.svg" alt="Deco" className="w-4 h-4" />
        }
        size="2xs"
      />
      deco chat
    </Button>
  );
};

const WELL_KNOWN_ORG_PATHS = [
  "/settings",
  "/theme-editor",
  "/models",
  "/usage",
  "/members",
  "/billing",
];

const useIsProjectContext = () => {
  const { org, project } = useParams();
  return !!org && !!project;
};

export const TopbarControls = () => {
  const location = useLocation();
  const { org } = useParams();
  const isProjectContext = useIsProjectContext();

  const isWellKnownOrgPath = WELL_KNOWN_ORG_PATHS.some((path) =>
    location.pathname.endsWith(path),
  );

  // Show button if we have an org context (project or org-level)
  if (!org && !isProjectContext && !isWellKnownOrgPath) {
    return null;
  }

  // Show regular chat button on other pages
  return <ToggleDecopilotButton />;
};

interface BreadcrumbItem {
  label: string | ReactNode;
  link?: string;
}

export function DefaultBreadcrumb({
  items,
  useWorkspaceLink: useWorkspaceLinkProp = true,
}: {
  items: BreadcrumbItem[];
  useWorkspaceLink?: boolean;
}) {
  const isMobile = useIsMobile();
  const withWorkspace = useWorkspaceLink();
  return (
    <div className="flex items-center gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          {isMobile ? (
            <BreadcrumbItem key={`mobile-${items.at(-1)?.link || "last"}`}>
              <BreadcrumbPage className="truncate">
                {items.at(-1)?.label}
              </BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            items?.map((item, index) => {
              const isLast = index === items.length - 1;
              const hasLink = Boolean(item.link);
              const link = hasLink
                ? useWorkspaceLinkProp
                  ? withWorkspace(item.link!)
                  : item.link!
                : "";

              if (isLast) {
                return (
                  <BreadcrumbItem
                    key={`last-${item.link || index}`}
                    className="min-w-0 flex-1"
                  >
                    <BreadcrumbPage className="truncate">
                      {item.label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                );
              }

              if (!hasLink) {
                return (
                  <Fragment key={`${index}`}>
                    <BreadcrumbItem className="shrink-0">
                      <span className="truncate">{item.label}</span>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="shrink-0" />
                  </Fragment>
                );
              }

              return (
                <Fragment key={`${item.link}-${index}`}>
                  <BreadcrumbItem className="shrink-0">
                    <BreadcrumbLink asChild href={link} className="truncate">
                      <Link to={link}>{item.label}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="shrink-0 " />
                </Fragment>
              );
            })
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
