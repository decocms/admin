import { Locator, SDKProvider } from "@deco/sdk";
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
  SidebarInset,
  SidebarLayout,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import { Toaster } from "@deco/ui/components/sonner.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { type DockviewApi, DockviewReadyEvent } from "dockview-react";
import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useParams } from "react-router";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { useUser } from "../../hooks/use-user.ts";
import RegisterActivity from "../common/register-activity.tsx";
import {
  DecopilotChat,
  DecopilotTabs,
  toggleDecopilotTab,
  useDecopilotParams,
} from "../decopilot/index.tsx";
import Docked, { type Tab } from "../dock/index.tsx";
import { ProfileModalProvider, useProfileModal } from "../profile-modal.tsx";
import { ProjectSidebar } from "../sidebar/index.tsx";
import { WithWorkspaceTheme } from "../theme.tsx";
import { TopbarLayout } from "./home.tsx";

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
      <Toaster />
    </SDKProvider>
  );
}

export function ProjectLayout() {
  const { value: defaultOpen, update: setDefaultOpen } = useLocalStorage({
    key: "deco-chat-sidebar",
    defaultValue: true,
  });
  const [open, setOpen] = useState(defaultOpen);
  const { org, project } = useParams();

  const {
    profileOpen,
    setProfileOpen,
    openProfileModal,
    closeProfileModal,
    handlePhoneSaved,
  } = useProfileModal();

  return (
    <BaseRouteLayout>
      <WithWorkspaceTheme>
        <ProfileModalProvider
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          openProfileModal={openProfileModal}
          closeProfileModal={closeProfileModal}
          handlePhoneSaved={handlePhoneSaved}
        >
          <SidebarProvider
            open={open}
            onOpenChange={(open) => {
              setDefaultOpen(open);
              setOpen(open);
            }}
          >
            <div className="flex flex-col h-full">
              <TopbarLayout breadcrumb={[]}>
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
                  <SidebarInset className="h-full flex-col bg-sidebar">
                    <Outlet />
                  </SidebarInset>
                </SidebarLayout>
              </TopbarLayout>
              <RegisterActivity orgSlug={org} projectSlug={project} />
            </div>
          </SidebarProvider>
        </ProfileModalProvider>
      </WithWorkspaceTheme>
    </BaseRouteLayout>
  );
}

export interface PageLayoutProps {
  tabs: Record<string, Tab>;
  hideViewsButton?: boolean;
}

const useIsProjectContext = () => {
  const { org, project } = useParams();
  return !!org && !!project;
};

export const ToggleDecopilotButton = () => {
  const isProjectContext = useIsProjectContext();
  const handleToggle = () => {
    globalThis.dispatchEvent(new CustomEvent("toggle-decopilot"));
  };

  if (!isProjectContext) {
    return null;
  }

  return (
    <Button size="sm" variant="special" onClick={handleToggle}>
      <img src="/img/logo-tiny.svg" alt="Deco logo" className="w-4 h-4" />
      Chat
    </Button>
  );
};

export function PageLayout({ tabs, hideViewsButton }: PageLayoutProps) {
  const { preferences, setPreferences } = useUserPreferences();
  const { initialInput, autoSend } = useDecopilotParams();
  const [dockApi, setDockApi] = useState<DockviewApi | null>(null);

  const withDecopilot = useMemo(
    () => ({
      ...tabs,
      [DecopilotChat.displayName]: {
        title: "Decopilot Chat",
        Component: DecopilotChat,
      },
    }),
    [tabs],
  );

  const onReady = (event: DockviewReadyEvent) => {
    setDockApi(event.api);

    if (preferences.showDecopilot || (autoSend && initialInput)) {
      toggleDecopilotTab(event.api);
    }
  };

  // Listen for toggle decopilot events
  useEffect(() => {
    const handleToggleDecopilot = () => {
      if (!dockApi) {
        return;
      }

      const isNowOpen = toggleDecopilotTab(dockApi);

      // Update user preference based on the action being taken
      // If we're opening the tab, set preference to true
      // If we're closing the tab, set preference to false
      setPreferences({
        ...preferences,
        showDecopilot: isNowOpen,
      });
    };

    globalThis.addEventListener("toggle-decopilot", handleToggleDecopilot);

    return () => {
      globalThis.removeEventListener("toggle-decopilot", handleToggleDecopilot);
    };
  }, [dockApi, preferences, setPreferences]);

  return (
    <Docked.Provider tabs={withDecopilot}>
      <div className="h-full p-0 md:px-0">
        <Docked
          hideViewsButton={hideViewsButton}
          onReady={onReady}
          tabComponents={{
            [DecopilotTabs.displayName]: DecopilotTabs,
          }}
        />
      </div>
    </Docked.Provider>
  );
}

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
    <div className="flex items-center gap-3 pl-2">
      <Breadcrumb>
        <BreadcrumbList>
          {isMobile ? (
            <BreadcrumbItem key={`mobile-${items.at(-1)?.link || "last"}`}>
              <BreadcrumbPage className="inline-flex items-center gap-2">
                {items.at(-1)?.label}
              </BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            items?.map((item, index) => {
              const isLast = index === items.length - 1;
              const link = useWorkspaceLinkProp
                ? withWorkspace(item.link ?? "")
                : (item.link ?? "");

              if (isLast) {
                return (
                  <BreadcrumbItem key={`last-${item.link || index}`}>
                    <BreadcrumbPage className="inline-flex items-center gap-2">
                      {item.label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                );
              }

              return (
                <Fragment key={`${item.link}-${index}`}>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      asChild
                      href={link}
                      className="inline-flex items-center gap-2"
                    >
                      <Link to={link}>{item.label}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              );
            })
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
