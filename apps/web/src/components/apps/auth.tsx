import {
  type Integration,
  Locator,
  type Project,
  type RegistryApp,
  RegistryAppNotFoundError,
  SDKProvider,
  type Team,
  useCreateOAuthCodeForIntegration,
  useIntegrations,
  useRegistryApp,
} from "@deco/sdk";
import {
  useMarketplaceIntegrations,
  useOrganizations,
  useProjects,
} from "@deco/sdk/hooks";
import { Button } from "@deco/ui/components/button.tsx";
import { Combobox } from "@deco/ui/components/combobox.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UseFormReturn } from "react-hook-form";
import { ErrorBoundary } from "../../error-boundary.tsx";
import {
  useInstallCreatingApiKeyAndIntegration,
  useIntegrationInstallState,
} from "../../hooks/use-integration-install.tsx";
import { useUser } from "../../hooks/use-user.ts";
import { Avatar } from "../common/avatar/index.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import {
  MarketplaceIntegration,
  VerifiedBadge,
} from "../integrations/marketplace.tsx";
import { OAuthCompletionDialog } from "../integrations/oauth-completion-dialog.tsx";
import {
  DependencyStep,
  InstallStepsButtons,
  OauthModalContextProvider,
  OauthModalState,
  useIntegrationInstallStep,
  useUIInstallIntegration,
} from "../integrations/select-connection-dialog.tsx";
import { AppsAuthLayout, OAuthSearchParams } from "./layout.tsx";
import { useBidcForTopWindow } from "../../lib/bidc.ts";
import * as z from "zod";

// Schema for messages from parent window
const ParentContextMessageSchema = z.object({
  type: z.literal("parent_context"),
  payload: z.object({
    org: z.string(),
    project: z.string(),
  }),
});

const preSelectTeam = (teams: Team[], workspace_hint: string | undefined) => {
  if (teams.length === 1) {
    return teams[0];
  }

  const getParentUrl = () => {
    try {
      if (globalThis.self !== globalThis.top) {
        return globalThis.top?.location.href;
      }
    } catch {
      return null;
    }
    return null;
  };

  const parentUrl = getParentUrl();
  if (parentUrl) {
    const workspacePattern = new URLPattern({ pathname: "/:root/*" });
    const workspaceMatch = workspacePattern.exec({ baseURL: parentUrl });

    if (workspaceMatch?.pathname?.groups?.root) {
      workspace_hint = workspaceMatch.pathname.groups.root;
    }
  }

  if (!workspace_hint) {
    return null;
  }

  return (
    teams.find(
      (team) =>
        team.slug === workspace_hint ||
        team.slug === workspace_hint.split("/").pop(),
    ) ?? null
  );
};

const useAppIntegrations = (appName: string) => {
  const { data: allIntegrations } = useIntegrations();
  return (
    allIntegrations?.filter((integration) => {
      if ("appName" in integration) {
        return integration.appName === appName;
      }
      return false;
    }) ?? []
  );
};

const NoAppFound = ({ client_id }: { client_id: string }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">App not found</h1>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground max-w-sm text-left">
          <p>
            The app you are trying to authorize (
            <span className="font-semibold">{client_id}</span>) does not exist.
          </p>
          <div className="w-full">
            <div className="border rounded-lg p-4 bg-muted flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Icon name="info" size={16} />
                <span className="font-medium">
                  Maybe you forgot to publish it?
                </span>
              </div>
              <a
                href="https://docs.deco.page/en/guides/deployment/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline text-sm"
              >
                How to publish your app
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const NoProjectFound = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">No projects available</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          You need to have at least one project on your account to authorize
          this app.
        </p>
      </div>
    </div>
  );
};

const SelectOrganization = ({
  registryApp,
  orgs,
  setOrg,
}: {
  registryApp: RegistryApp;
  orgs: Team[];
  setOrg: (team: Team | null) => void;
}) => {
  const [selectedOrg, setSelectedOrg] = useState<Team | null>(null);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center flex flex-col gap-10 w-96">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center">
            <Avatar
              shape="square"
              size="xl"
              objectFit="contain"
              url={registryApp.icon}
              fallback={registryApp.friendlyName ?? registryApp.name}
            />
          </div>
          <h1 className="text-xl font-semibold">
            Authorize {registryApp.friendlyName ?? registryApp.name}
          </h1>
        </div>

        <div className="flex flex-col items-start gap-2 w-full">
          <p className="text-sm text-foreground">
            Select an organization to use this app
          </p>
          <div className="w-full">
            <Combobox
              options={orgs.map((team) => ({
                value: team.slug,
                label: team.name,
                avatarUrl: team.avatar_url,
              }))}
              value={selectedOrg?.slug ?? ""}
              onChange={(value) =>
                setSelectedOrg(orgs.find((team) => team.slug === value) ?? null)
              }
              placeholder="Select an organization"
              width="w-full"
              triggerClassName="!h-16"
              contentClassName="w-full"
              renderTrigger={(selectedOption) => (
                <div className="flex items-center justify-between w-full h-16 px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <div className="flex items-center gap-3">
                    {selectedOption ? (
                      <>
                        <Avatar
                          url={selectedOption.avatarUrl as string}
                          fallback={selectedOption.label}
                          size="sm"
                          shape="square"
                          objectFit="contain"
                        />
                        <span>{selectedOption.label}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Select an organization
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="opacity-50" />
                </div>
              )}
              renderItem={(option, isSelected) => (
                <div className="flex items-center gap-3 h-12">
                  <Avatar
                    url={option.avatarUrl as string}
                    fallback={option.label}
                    size="sm"
                    shape="square"
                    objectFit="contain"
                  />
                  <span>{option.label}</span>
                  <Check
                    className={cn(
                      "ml-auto",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
              )}
            />
          </div>
        </div>

        <Button
          className="w-full"
          disabled={!selectedOrg}
          onClick={() => setOrg(selectedOrg)}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

const SelectProject = ({
  registryApp,
  projects,
  setProjectSlug,
  onBack,
}: {
  registryApp: RegistryApp;
  projects: Project[];
  setProjectSlug: (slug: string) => void;
  onBack: () => void;
}) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center flex flex-col gap-10 w-96">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center">
            <Avatar
              shape="square"
              size="xl"
              objectFit="contain"
              url={registryApp.icon}
              fallback={registryApp.friendlyName ?? registryApp.name}
            />
          </div>
          <h1 className="text-xl font-semibold">
            Authorize {registryApp.friendlyName ?? registryApp.name}
          </h1>
        </div>

        <div className="flex flex-col items-start gap-2 w-full">
          <p className="text-sm text-foreground">
            Select a project to use this app
          </p>
          <div className="w-full">
            <Combobox
              options={projects.map((project) => ({
                value: project.slug,
                label: project.title,
                avatarUrl: project.avatar_url,
              }))}
              value={selectedProject?.slug ?? ""}
              onChange={(value) =>
                setSelectedProject(
                  projects.find((p) => p.slug === value) ?? null,
                )
              }
              placeholder="Select a project"
              width="w-full"
              triggerClassName="!h-16"
              contentClassName="w-full"
              renderTrigger={(selectedOption) => (
                <div className="flex items-center justify-between w-full h-16 px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <div className="flex items-center gap-3">
                    {selectedOption ? (
                      <>
                        <Avatar
                          url={selectedOption.avatarUrl as string}
                          fallback={selectedOption.label}
                          size="sm"
                          shape="square"
                          objectFit="contain"
                        />
                        <span>{selectedOption.label}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Select a project
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="opacity-50" />
                </div>
              )}
              renderItem={(option, isSelected) => (
                <div className="flex items-center gap-3 h-12">
                  <Avatar
                    url={option.avatarUrl as string}
                    fallback={option.label}
                    size="sm"
                    shape="square"
                    objectFit="contain"
                  />
                  <span>{option.label}</span>
                  <Check
                    className={cn(
                      "ml-auto",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
              )}
            />
          </div>
        </div>

        <div className="flex gap-2 w-full">
          <Button variant="outline" className="w-1/2" onClick={onBack}>
            Back
          </Button>
          <Button
            className="w-1/2"
            disabled={!selectedProject}
            onClick={() =>
              selectedProject && setProjectSlug(selectedProject.slug)
            }
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

const SelectableInstallList = ({
  installedIntegrations,
  setSelectedIntegration,
  selectCreateNew,
  selectedIntegration,
}: {
  selectedIntegration: Integration | null;
  installedIntegrations: Integration[];
  setSelectedIntegration: (integration: Integration) => void;
  selectCreateNew: () => void;
}) => {
  return (
    <div className="flex flex-col items-center space-y-2 w-full">
      <p className="text-sm self-start">
        Select an existing install or create a new one
      </p>

      {installedIntegrations.map((integration) => (
        <Button
          key={integration.id}
          variant="outline"
          onClick={() => setSelectedIntegration(integration)}
          className={cn(
            "w-full h-16 justify-start px-3 py-3",
            selectedIntegration?.id === integration.id
              ? "border-foreground"
              : "",
          )}
        >
          <IntegrationAvatar
            url={integration.icon}
            fallback={integration.name}
            size="base"
          />
          <span className="text-sm">{integration.name}</span>
        </Button>
      ))}

      <Button
        variant="outline"
        onClick={selectCreateNew}
        className="w-full h-16 justify-start px-3 py-3"
      >
        <Icon name="add" size={16} />
        <span className="text-sm">Create new</span>
      </Button>
    </div>
  );
};

const _InlineInstallation = ({
  integration,
  onConfirm,
}: {
  integration: MarketplaceIntegration;
  onConfirm: (data: {
    authorizeOauthUrl: string | null;
    connection: Integration;
  }) => void;
}) => {
  const integrationState = useIntegrationInstallState(integration?.name);
  const formRef = useRef<UseFormReturn<Record<string, unknown>> | null>(null);
  const { install, isLoading } = useUIInstallIntegration({
    onConfirm,
    validate: () => formRef.current?.trigger() ?? Promise.resolve(true),
  });
  const {
    stepIndex,
    currentSchema,
    totalSteps,
    dependencyName,
    handleNextDependency,
    handleBack,
  } = useIntegrationInstallStep({
    integrationState,
    install: () =>
      install({ integration, mainFormData: formRef.current?.getValues() }),
  });

  return (
    <>
      <DependencyStep
        integration={integration}
        dependencyName={dependencyName}
        dependencySchema={currentSchema}
        currentStep={stepIndex + 1}
        totalSteps={totalSteps}
        formRef={formRef}
        integrationState={integrationState}
        mode="column"
      />
      <div className="flex justify-end px-4 py-2 gap-2">
        <InstallStepsButtons
          stepIndex={stepIndex}
          isLoading={isLoading}
          hasNextStep={stepIndex < totalSteps - 1}
          integrationState={integrationState}
          handleNextDependency={handleNextDependency}
          handleBack={handleBack}
        />
      </div>
    </>
  );
};

const InlineInstallation = ({
  integrationName,
  onConfirm,
}: {
  integrationName: string;
  onConfirm: (data: {
    authorizeOauthUrl: string | null;
    connection: Integration;
  }) => void;
}) => {
  const { data: marketplace } = useMarketplaceIntegrations();
  const integration = useMemo(() => {
    return marketplace?.integrations.find(
      (integration) => integration.name === integrationName,
    );
  }, [marketplace, integrationName]);

  if (!integration) {
    return (
      <div className="flex flex-col items-center justify-center my-auto h-full py-8">
        <Icon name="error" size={48} className="text-destructive" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Integration not found</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            The app <span className="font-semibold">{integrationName}</span>{" "}
            could not be found in the marketplace. Please make sure it has been
            published and is available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <_InlineInstallation integration={integration} onConfirm={onConfirm} />
  );
};

const FooterButtons = ({
  backLabel,
  onClickBack,
  onClickContinue,
  continueDisabled,
  continueLoading,
}: {
  backLabel: string;
  onClickBack: () => void;
  onClickContinue: (e: React.FormEvent) => Promise<void> | void;
  continueDisabled: boolean;
  continueLoading: boolean;
}) => {
  return (
    <div className="pt-4 flex items-center justify-center gap-2 w-full">
      <Button variant="outline" onClick={onClickBack} className="w-1/2">
        {backLabel}
      </Button>
      <Button
        className="w-1/2"
        disabled={continueDisabled}
        onClick={onClickContinue}
      >
        {continueLoading ? (
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            Authorizing...
          </div>
        ) : (
          `Continue`
        )}
      </Button>
    </div>
  );
};

const SelectProjectAppInstance = ({
  app,
  org,
  project,
  selectAnotherProject,
  clientId,
  redirectUri,
  state,
  autoConfirmIntegrationId,
  mode = "direct",
}: {
  app: RegistryApp;
  org: Team;
  mode?: "proxy" | "direct";
  project: string;
  selectAnotherProject: () => void;
  clientId: string;
  redirectUri: string;
  state: string | undefined;
  autoConfirmIntegrationId?: string | null;
}) => {
  console.log("SelectProjectAppInstance loaded");
  const installedIntegrations = useAppIntegrations(clientId);
  const createOAuthCode = useCreateOAuthCodeForIntegration();
  const installCreatingApiKeyAndIntegration =
    useInstallCreatingApiKeyAndIntegration();

  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(() => installedIntegrations[0] ?? null);
  const [inlineCreatingIntegration, setInlineCreatingIntegration] =
    useState<boolean>(() => installedIntegrations.length === 0);
  const [oauthCompletionDialog, setOauthCompletionDialog] =
    useState<OauthModalState>({
      open: false,
      url: "",
      integrationName: "",
      connection: null,
      openIntegrationOnFinish: true,
    });

  const autoConfirmRef = useRef(false);

  const createOAuthCodeAndRedirectBackToApp = async ({
    integrationId,
  }: {
    integrationId: string;
  }) => {
    const { redirectTo } = await createOAuthCode.mutateAsync({
      integrationId,
      mode,
      workspace: Locator.from({ org: org.slug, project }),
      redirectUri,
      state,
    });
    globalThis.location.href = redirectTo;
  };

  // Auto-confirm if integrationId is provided and there's only 1 integration
  useEffect(() => {
    if (
      autoConfirmIntegrationId === "auto" &&
      installedIntegrations.length === 1 &&
      !autoConfirmRef.current
    ) {
      autoConfirmRef.current = true;
      console.log(
        "Auto-confirming with single integration:",
        installedIntegrations[0].id,
      );
      createOAuthCodeAndRedirectBackToApp({
        integrationId: installedIntegrations[0].id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConfirmIntegrationId, installedIntegrations]);

  return (
    <div className="flex flex-col items-center justify-start h-full w-full py-6 overflow-y-auto">
      <div className="text-center space-y-6 max-w-md w-full m-auto">
        {inlineCreatingIntegration ? null : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-2">
              <div className="relative">
                <Avatar
                  shape="square"
                  url={org.avatar_url}
                  fallback={org.name}
                  objectFit="contain"
                  size="xl"
                />
              </div>

              <div className="relative -mx-4 z-50 bg-background border border-border rounded-lg w-8 h-8 flex items-center justify-center">
                <Icon
                  name="sync_alt"
                  size={24}
                  className="text-muted-foreground"
                />
              </div>

              <div className="relative">
                <IntegrationAvatar
                  url={app.icon}
                  fallback={app.friendlyName ?? app.name}
                  size="xl"
                />
              </div>
            </div>
            <h1 className="text-xl font-semibold flex items-start gap-2">
              <span>Authorize {app.friendlyName ?? app.name}</span>
              <div className="mt-2">{app.verified && <VerifiedBadge />}</div>
            </h1>
          </div>
        )}

        {inlineCreatingIntegration ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center space-y-4 w-full">
                <Spinner size="sm" />
                <p className="text-sm text-muted-foreground">
                  Loading app settings...
                </p>
              </div>
            }
          >
            <OauthModalContextProvider.Provider
              value={{ onOpenOauthModal: setOauthCompletionDialog }}
            >
              <div className="h-[80vh]">
                <InlineInstallation
                  integrationName={clientId}
                  // create callback
                  onConfirm={({ connection, authorizeOauthUrl }) => {
                    if (authorizeOauthUrl) {
                      const popup = globalThis.open(
                        authorizeOauthUrl,
                        "_blank",
                      );
                      if (
                        !popup ||
                        popup.closed ||
                        typeof popup.closed === "undefined"
                      ) {
                        setOauthCompletionDialog({
                          openIntegrationOnFinish: true,
                          open: true,
                          url: authorizeOauthUrl,
                          integrationName: connection?.name || "the service",
                          connection: connection,
                        });
                      }
                    }
                    createOAuthCodeAndRedirectBackToApp({
                      integrationId: connection.id,
                    });
                  }}
                />
              </div>
            </OauthModalContextProvider.Provider>
            <OAuthCompletionDialog
              open={oauthCompletionDialog.open}
              onOpenChange={(open) => {
                setOauthCompletionDialog((prev) => ({ ...prev, open }));
                // if (
                //   oauthCompletionDialog.connection &&
                //   oauthCompletionDialog.openIntegrationOnFinish
                // ) {
                //   onSelect?.(oauthCompletionDialog.connection);
                // }
              }}
              authorizeOauthUrl={oauthCompletionDialog.url}
              integrationName={oauthCompletionDialog.integrationName}
            />
          </Suspense>
        ) : (
          <SelectableInstallList
            installedIntegrations={installedIntegrations}
            setSelectedIntegration={setSelectedIntegration}
            selectCreateNew={() => {
              setInlineCreatingIntegration(true);
              setSelectedIntegration(null);
            }}
            selectedIntegration={selectedIntegration}
          />
        )}

        {inlineCreatingIntegration ? null : (
          <FooterButtons
            backLabel="Change project"
            onClickBack={selectAnotherProject}
            onClickContinue={() => {
              if (!selectedIntegration) {
                throw new Error("No integration selected");
              }
              createOAuthCodeAndRedirectBackToApp({
                integrationId: selectedIntegration.id,
              });
            }}
            continueDisabled={
              !selectedIntegration ||
              createOAuthCode.isPending ||
              installCreatingApiKeyAndIntegration.isPending
            }
            continueLoading={
              createOAuthCode.isPending ||
              installCreatingApiKeyAndIntegration.isPending
            }
          />
        )}
      </div>
    </div>
  );
};

function ProjectSelectionFlow({
  org,
  registryApp,
  onBack,
  onProjectSelected,
}: {
  org: Team;
  registryApp: RegistryApp;
  onBack: () => void;
  onProjectSelected: (projectSlug: string) => void;
}) {
  const projects = useProjects({ org: org.slug });

  // Auto-select and proceed if only 1 project
  useEffect(() => {
    if (projects.length === 1) {
      onProjectSelected(projects[0].slug);
    }
  }, [projects, onProjectSelected]);

  // No projects found
  if (projects.length === 0) {
    return <NoProjectFound />;
  }

  // Loading state while auto-selecting single project
  if (projects.length === 1) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  // Show selector if multiple projects
  return (
    <SelectProject
      registryApp={registryApp}
      projects={projects}
      setProjectSlug={onProjectSelected}
      onBack={onBack}
    />
  );
}

function AppsOAuth({
  client_id,
  redirect_uri,
  state,
  workspace_hint,
  mode = "direct",
}: OAuthSearchParams) {
  const { data: registryApp } = useRegistryApp({ app: client_id });
  const { data: orgs } = useOrganizations();
  const orgsRef = useRef(orgs);
  const [org, setOrg] = useState<Team | null>(() =>
    preSelectTeam(orgs, workspace_hint),
  );
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string | null>(
    null,
  );

  // Simple check - not reactive, just a one-time value
  const inIframe = globalThis.self !== globalThis.top;

  const [waitingForParentContext, setWaitingForParentContext] =
    useState(inIframe);
  const [autoConfirmIntegrationId, setAutoConfirmIntegrationId] = useState<
    string | null
  >(null);

  // Keep orgsRef up to date
  useEffect(() => {
    orgsRef.current = orgs;
  }, [orgs]);

  const selectedOrgSlug = useMemo(() => {
    if (!org) {
      return null;
    }
    return org.slug;
  }, [org]);

  const handleParentMessage = useCallback(
    ({ payload }: { payload: { org: string; project: string } }) => {
      console.log("Received parent context:", payload);
      setWaitingForParentContext(false);

      // Auto-select org and project based on parent context
      const matchingOrg = orgsRef.current?.find((o) => o.slug === payload.org);
      if (matchingOrg) {
        setOrg(matchingOrg);
        setSelectedProjectSlug(payload.project);
        // Signal that we should auto-confirm if only 1 integration
        setAutoConfirmIntegrationId("auto");
      }
    },
    [],
  );

  // Listen for parent context messages
  useBidcForTopWindow({
    messageSchema: ParentContextMessageSchema,
    onMessage: handleParentMessage,
  });

  // Set up timeout on mount - only if in iframe
  useEffect(() => {
    if (!inIframe || !waitingForParentContext) return;

    const timeout = setTimeout(() => {
      console.warn("Timeout waiting for parent context, showing UI");
      setWaitingForParentContext(false);
    }, 2000);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Show loading state while waiting for parent context in iframe
  if (inIframe && waitingForParentContext) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">
          Loading authorization...
        </p>
      </div>
    );
  }

  if (!orgs || orgs.length === 0 || !registryApp) {
    return <NoProjectFound />;
  }

  if (!selectedOrgSlug || !org) {
    return (
      <SelectOrganization
        registryApp={registryApp}
        orgs={orgs}
        setOrg={setOrg}
      />
    );
  }

  if (!selectedProjectSlug) {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen">
            <Spinner />
          </div>
        }
      >
        <ProjectSelectionFlow
          org={org}
          registryApp={registryApp}
          onBack={() => setOrg(null)}
          onProjectSelected={setSelectedProjectSlug}
        />
      </Suspense>
    );
  }

  const locator = Locator.from({
    org: selectedOrgSlug,
    project: selectedProjectSlug,
  });

  return (
    <SDKProvider locator={locator}>
      <SelectProjectAppInstance
        app={registryApp}
        org={org}
        project={selectedProjectSlug}
        selectAnotherProject={() => setSelectedProjectSlug(null)}
        clientId={client_id}
        redirectUri={redirect_uri}
        state={state}
        autoConfirmIntegrationId={autoConfirmIntegrationId}
        mode={mode}
      />
    </SDKProvider>
  );
}

export default function Page() {
  return (
    <AppsAuthLayout>
      {(props) => {
        useUser();
        return (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Spinner />
              </div>
            }
          >
            <ErrorBoundary
              shouldCatch={(error) => error instanceof RegistryAppNotFoundError}
              fallback={<NoAppFound client_id={props.client_id} />}
            >
              <AppsOAuth {...props} />
            </ErrorBoundary>
          </Suspense>
        );
      }}
    </AppsAuthLayout>
  );
}
