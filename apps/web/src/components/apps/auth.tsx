import {
  type Integration,
  RegistryAppNotFoundError,
  SDKProvider,
  useCreateOAuthCodeForIntegration,
  useIntegrations,
  type Workspace,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Combobox } from "@deco/ui/components/combobox.tsx";
import { useMemo, useState, Suspense, useRef } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@deco/ui/lib/utils.ts";
import { useUser } from "../../hooks/use-user.ts";
import { Avatar } from "../common/avatar/index.tsx";
import { type CurrentTeam, useUserTeams } from "../sidebar/team-selector.tsx";
import { AppsAuthLayout, OAuthSearchParams } from "./layout.tsx";
import { useRegistryApp, type RegistryApp } from "@deco/sdk";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useInstallCreatingApiKeyAndIntegration } from "../../hooks/use-integration-install.tsx";
import { UseFormReturn } from "react-hook-form";
import {
  useMarketplaceAppSchema,
  usePermissionDescriptions,
} from "@deco/sdk/hooks";
import type { JSONSchema7 } from "json-schema";
import { getAllScopes } from "../../utils/scopes.ts";
import { VerifiedBadge } from "../integrations/marketplace.tsx";
import {
  IntegrationPermissions,
  IntegrationBindingForm,
} from "../integration-oauth.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";

type InlineFormStep = "permissions" | "requirements";

const preSelectTeam = (
  teams: CurrentTeam[],
  workspace_hint: string | undefined,
) => {
  if (teams.length === 1) {
    return teams[0];
  }

  const getParentUrl = () => {
    try {
      if (globalThis.self !== globalThis.top) {
        return globalThis.top?.location.href;
      }
    } catch (_) {
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
  return allIntegrations?.filter((integration) => {
    if ("appName" in integration) {
      return integration.appName === appName;
    }
    return false;
  });
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

const SelectProject = ({
  registryApp,
  teams,
  setTeam,
}: {
  registryApp: RegistryApp;
  teams: CurrentTeam[];
  setTeam: (team: CurrentTeam | null) => void;
}) => {
  const [selectedTeam, setSelectedTeam] = useState<CurrentTeam | null>(null);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center flex flex-col gap-10 w-96">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center">
            <IntegrationAvatar
              url={registryApp.icon}
              fallback={registryApp.friendlyName ?? registryApp.name}
              size="xl"
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
              options={teams.map((team) => ({
                value: team.slug,
                label: team.label,
                avatarUrl: team.avatarUrl,
              }))}
              value={selectedTeam?.slug ?? ""}
              onChange={(value) =>
                setSelectedTeam(
                  teams.find((team) => team.slug === value) ?? null,
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

        <Button
          className="w-full"
          disabled={!selectedTeam}
          onClick={() => setTeam(selectedTeam)}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

const InlineCreateIntegrationForm = ({
  appName,
  onFormSubmit,
  onBack,
  backEnabled,
}: {
  appName: string;
  onFormSubmit: ({
    formData,
    scopes,
  }: {
    formData: Record<string, unknown>;
    scopes: string[];
  }) => Promise<void>;
  onBack: () => void;
  backEnabled: boolean;
}) => {
  const { data, isLoading } = useMarketplaceAppSchema(appName);
  const scopes = data?.scopes ?? [];
  const schema = data?.schema as JSONSchema7;
  const [currentStep, setCurrentStep] = useState<InlineFormStep>("permissions");
  const formRef = useRef<UseFormReturn<Record<string, unknown>> | null>(null);

  // Get permission descriptions
  const allScopes = getAllScopes(scopes, schema);
  const { permissions } = usePermissionDescriptions(allScopes);

  const shouldShowPermissions = useMemo(() => {
    return permissions.length > 0;
  }, [permissions]);

  const shouldShowForm = useMemo(() => {
    return schema?.properties && Object.keys(schema.properties).length > 0;
  }, [schema]);

  const handleContinueFromPermissions = () => {
    if (shouldShowForm) {
      setCurrentStep("requirements");
    } else {
      handleFormSubmit();
    }
  };

  const handleBack = () => {
    setCurrentStep("permissions");
  };

  const handleFormSubmit = async () => {
    const formData = formRef.current?.getValues() ?? {};
    await onFormSubmit({
      formData,
      scopes,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center space-y-4 w-full">
        <Spinner size="sm" />
        <p className="text-sm text-muted-foreground">
          Loading app permissions...
        </p>
      </div>
    );
  }

  // If no permissions and no form, show simple continue
  if (!shouldShowPermissions && !shouldShowForm) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-sm text-muted-foreground mb-4">
          No configuration required
        </p>
        <FooterButtons
          backLabel={backEnabled ? "Back" : "Change project"}
          onClickBack={onBack}
          onClickContinue={handleFormSubmit}
          continueDisabled={false}
          continueLoading={false}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 w-full text-left">
      {/* Step 1: Permissions */}
      {currentStep === "permissions" && shouldShowPermissions && (
        <ScrollArea className="h-[400px] pr-4">
          <IntegrationPermissions
            permissions={permissions}
            integrationName={appName}
          />
        </ScrollArea>
      )}

      {/* Step 2: Requirements/Configuration */}
      {currentStep === "requirements" && shouldShowForm && schema && (
        <IntegrationBindingForm schema={schema} formRef={formRef} />
      )}

      {/* Footer buttons */}
      <div className="pt-4 flex items-center justify-center gap-2 w-full">
        <Button
          variant="outline"
          onClick={currentStep !== "permissions" ? handleBack : onBack}
          className="w-1/2"
        >
          Back
        </Button>
        <Button
          className="w-1/2"
          onClick={
            currentStep === "permissions"
              ? handleContinueFromPermissions
              : handleFormSubmit
          }
        >
          {shouldShowForm ? "Continue" : "Connect"}
        </Button>
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
        <span className="text-sm">Create new </span>
      </Button>
    </div>
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
  project,
  workspace,
  selectAnotherProject,
  clientId,
  redirectUri,
  state,
}: {
  app: RegistryApp;
  project: CurrentTeam;
  workspace: Workspace;
  selectAnotherProject: () => void;
  clientId: string;
  redirectUri: string;
  state: string | undefined;
}) => {
  const installedIntegrations = useAppIntegrations(clientId);
  const createOAuthCode = useCreateOAuthCodeForIntegration();
  const installCreatingApiKeyAndIntegration =
    useInstallCreatingApiKeyAndIntegration();

  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(() => installedIntegrations[0] ?? null);
  const [inlineCreatingIntegration, setInlineCreatingIntegration] =
    useState<boolean>(() => installedIntegrations.length === 0);

  const handleFormSubmit = async ({
    formData,
    scopes,
  }: {
    formData: Record<string, unknown>;
    scopes: string[];
  }) => {
    const integration = await installCreatingApiKeyAndIntegration.mutateAsync({
      clientId,
      app,
      formData,
      scopes,
    });

    await createOAuthCodeAndRedirectBackToApp({
      integrationId: integration.id,
    });
  };

  const createOAuthCodeAndRedirectBackToApp = async ({
    integrationId,
  }: {
    integrationId: string;
  }) => {
    const { redirectTo } = await createOAuthCode.mutateAsync({
      integrationId,
      workspace,
      redirectUri,
      state,
    });
    globalThis.location.href = redirectTo;
  };

  return (
    <div className="flex flex-col items-center justify-start h-full w-full py-6 overflow-y-auto">
      <div className="text-center space-y-6 max-w-md w-full m-auto">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <Avatar
                shape="square"
                url={project.avatarUrl}
                fallback={project.label}
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

        {inlineCreatingIntegration ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center space-y-4 w-full">
                <Spinner size="sm" />
                <p className="text-sm text-muted-foreground">
                  Loading app permissions...
                </p>
              </div>
            }
          >
            <InlineCreateIntegrationForm
              appName={clientId}
              onFormSubmit={handleFormSubmit}
              onBack={() => {
                if (installedIntegrations.length > 0) {
                  setInlineCreatingIntegration(false);
                } else {
                  selectAnotherProject();
                }
              }}
              backEnabled={installedIntegrations.length > 0}
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

function AppsOAuth({
  client_id,
  redirect_uri,
  state,
  workspace_hint,
}: OAuthSearchParams) {
  const { data: registryApp } = useRegistryApp({ clientId: client_id });
  const teams = useUserTeams();
  const user = useUser();
  const [team, setTeam] = useState<CurrentTeam | null>(
    preSelectTeam(teams, workspace_hint),
  );

  const selectedWorkspace = useMemo(() => {
    if (!team) {
      return null;
    }
    return team.id === user.id ? `users/${user.id}` : `shared/${team.slug}`;
  }, [team]);

  if (!teams || teams.length === 0) {
    return <NoProjectFound />;
  }

  if (!selectedWorkspace || !team) {
    return (
      <SelectProject
        registryApp={registryApp}
        teams={teams}
        setTeam={setTeam}
      />
    );
  }

  return (
    <SDKProvider workspace={selectedWorkspace as Workspace}>
      <SelectProjectAppInstance
        app={registryApp}
        project={team}
        workspace={selectedWorkspace as Workspace}
        selectAnotherProject={() => setTeam(null)}
        clientId={client_id}
        redirectUri={redirect_uri}
        state={state}
      />
    </SDKProvider>
  );
}

export default function Page() {
  return (
    <AppsAuthLayout>
      {(props) => (
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
      )}
    </AppsAuthLayout>
  );
}
