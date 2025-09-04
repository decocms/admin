import { useMarketplaceIntegrations, type Integration } from "@deco/sdk";
import { AppName } from "@deco/sdk/common";
import { useGetRegistryApp } from "@deco/sdk/hooks";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useCreateCustomConnection } from "../../hooks/use-create-custom-connection.ts";
import { useIntegrationInstall } from "../../hooks/use-integration-install.tsx";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import {
  IntegrationPermissions,
  IntegrationBindingForm,
} from "../integration-oauth.tsx";
import { IntegrationIcon } from "./common.tsx";
import { InstalledConnections } from "./installed-connections.tsx";
import {
  Marketplace,
  NEW_CUSTOM_CONNECTION,
  type MarketplaceIntegration,
} from "./marketplace.tsx";
import { OAuthCompletionDialog } from "./oauth-completion-dialog.tsx";
import { UseFormReturn } from "react-hook-form";
import type { JSONSchema7 } from "json-schema";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { Avatar } from "../common/avatar/index.tsx";

function GridRightColumn({ children }: { children: React.ReactNode }) {
  return (
    <div data-right-column className="col-span-6 py-4">
      {children}
    </div>
  );
}

function GridLeftColumn({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-left-column
      className="flex flex-col justify-between col-span-4 py-4 pr-4"
    >
      {children}
    </div>
  );
}

function GridContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-grid-container
      className="flex-1 grid grid-cols-10 gap-6 h-full divide-x border-b"
    >
      {children}
    </div>
  );
}

function CurrentTeamIcon() {
  const { avatarUrl, label } = useCurrentTeam();
  return (
    <Avatar
      shape="square"
      url={avatarUrl}
      fallback={label}
      objectFit="contain"
      size="xl"
    />
  );
}

function IntegrationNotVerifiedAlert() {
  return (
    <Alert className="border-base bg-muted/10 text-base-foreground">
      <Icon name="warning" size={16} className="text-base-foreground" />
      <AlertDescription>
        <div className="flex items-center gap-2">
          <span className="font-medium">Third-party integration</span>
        </div>
        <p className="mt-1 text-sm">
          This integration is provided by a third party and is not maintained by
          deco.
          <br />
        </p>
      </AlertDescription>
    </Alert>
  );
}

function IntegrationWorkspaceIcon({
  integration,
}: {
  integration: MarketplaceIntegration | null;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Left app icon */}
      <div className="rounded-lg flex items-center justify-center">
        <IntegrationIcon
          icon={integration?.icon}
          name={integration?.friendlyName ?? integration?.name}
          size="xl"
        />
      </div>

      {/* Right workspace icon */}
      <div className="rounded-lg flex items-center justify-center">
        <CurrentTeamIcon />
      </div>

      {/* Connection arrow */}
      <div className="flex items-center justify-center absolute -translate-x-4 ml-17 w-8 h-8 bg-white border rounded-lg">
        <Icon name="sync_alt" size={24} className="text-muted-foreground" />
      </div>
    </div>
  );
}

type DialogStep = "permissions" | "requirements";

export function ConfirmMarketplaceInstallDialog({
  integration,
  setIntegration,
  onConfirm,
}: {
  integration: MarketplaceIntegration | null;
  setIntegration: (integration: MarketplaceIntegration | null) => void;
  onConfirm: ({
    connection,
    authorizeOauthUrl,
  }: {
    connection: Integration;
    authorizeOauthUrl: string | null;
  }) => void;
}) {
  const open = !!integration;
  const { install, integrationState, isLoading } = useIntegrationInstall(
    integration?.name,
  );
  const formRef = useRef<UseFormReturn<Record<string, unknown>> | null>(null);
  const buildWorkspaceUrl = useWorkspaceLink();
  const navigateWorkspace = useNavigateWorkspace();
  const [currentStep, setCurrentStep] = useState<DialogStep>("permissions");
  const handleConnect = async () => {
    if (!integration) return;

    const returnUrl = new URL(
      buildWorkspaceUrl("/connections/success"),
      globalThis.location.origin,
    );

    const formData = formRef.current?.getValues() ?? null;
    try {
      const result = await install(
        {
          appId: integration.id,
          appName: integration.name,
          provider: integration.provider,
          returnUrl: returnUrl.href,
        },
        formData,
      );

      if (typeof result.integration?.id !== "string") {
        console.error(
          "Installed integration is not a string",
          result.integration,
        );
        return;
      }

      trackEvent("integration_install", {
        success: true,
        data: integration,
      });

      // Only call onConfirm if we have a redirect URL (traditional OAuth flow)
      // For stateSchema, the modal will handle the completion
      if (result.redirectUrl) {
        onConfirm({
          connection: result.integration,
          authorizeOauthUrl: result.redirectUrl,
        });
        setIntegration(null);
      } else if (result.stateSchema) {
        onConfirm({
          connection: result.integration,
          authorizeOauthUrl: null,
        });
        setIntegration(null);
      } else if (!result.stateSchema) {
        let link = `/connection/${integration.provider}:::${integration.name}`;
        const isDecoApp = integration.name.startsWith("@deco/");
        if (
          result.redirectUrl === null &&
          isDecoApp &&
          integration.friendlyName
        ) {
          // special case for non oauth-apps
          link = `/connection/deco:::${integration.friendlyName}`;
        }
        navigateWorkspace(link);
      }
    } catch (error) {
      trackEvent("integration_install", {
        success: false,
        data: integration,
        error,
      });
    }
  };

  // Reset step when dialog closes/opens
  useEffect(() => {
    if (open) {
      setCurrentStep("permissions");
    }
  }, [open]);

  const hasRequirements =
    integrationState.schema &&
    Object.keys(integrationState.schema.properties || {}).length > 0;

  const handleContinueFromPermissions = () => {
    if (hasRequirements) {
      setCurrentStep("requirements");
    } else {
      handleConnect();
    }
  };

  const handleBack = () => {
    setCurrentStep("permissions");
  };

  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={() => setIntegration(null)}>
      <DialogContent className="lg:!w-210 lg:!max-w-210 lg:min-h-135 lg:max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Connect to {integration.friendlyName ?? integration.name}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Permissions */}
        {currentStep === "permissions" && (
          <PermissionsStep
            integration={integration}
            integrationState={integrationState}
          />
        )}

        {/* Step 2: Requirements */}
        {currentStep === "requirements" && integrationState.schema && (
          <RequirementsStep
            integration={integration}
            schema={integrationState.schema}
            formRef={formRef}
          />
        )}
        <DialogFooter>
          {currentStep !== "permissions" && (
            <Button variant="outline" disabled={isLoading} onClick={handleBack}>
              Back
            </Button>
          )}
          <Button
            onClick={
              isLoading
                ? undefined
                : currentStep === "permissions"
                  ? handleContinueFromPermissions
                  : handleConnect
            }
            disabled={isLoading}
          >
            {isLoading
              ? "Connecting..."
              : hasRequirements
                ? "Continue"
                : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Step 1: Permissions
function PermissionsStep({
  integration,
  integrationState,
}: {
  integration: MarketplaceIntegration;
  integrationState: {
    permissions?: Array<{ scope: string; description: string }>;
  };
}) {
  return (
    <GridContainer>
      {/* Left side: App icons, connection, and warning */}
      <GridLeftColumn>
        {/* App icons with connection arrow */}
        <div className="space-y-8">
          <IntegrationWorkspaceIcon integration={integration} />

          {/* Permissions description */}
          <h3 className="text-xl text-base-foreground">
            <span className="font-bold">
              {integration.friendlyName ?? integration.name}
            </span>{" "}
            will have access to the following permissions:
          </h3>
        </div>

        {/* Warning at bottom left */}
        <div className="mt-auto">
          {!integration.verified && <IntegrationNotVerifiedAlert />}
        </div>
      </GridLeftColumn>

      {/* Right side: Scrollable permissions */}
      <GridRightColumn>
        <ScrollArea className="h-[400px] pr-4">
          {integrationState.permissions &&
          integrationState.permissions.length > 0 ? (
            <IntegrationPermissions
              integrationName={integration.name}
              permissions={integrationState.permissions}
            />
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <Icon
                  name="check_circle"
                  size={48}
                  className="mx-auto mb-2 text-success"
                />
                <p>No special permissions required</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </GridRightColumn>
    </GridContainer>
  );
}

// Step 2: Requirements
function RequirementsStep({
  integration,
  schema,
  formRef,
}: {
  integration: MarketplaceIntegration;
  schema: JSONSchema7;
  formRef: React.RefObject<UseFormReturn<Record<string, unknown>> | null>;
}) {
  return (
    <GridContainer>
      {/* Left side: App title and instructions */}
      <GridLeftColumn>
        <div className="space-y-8">
          <IntegrationWorkspaceIcon integration={integration} />
          {/* App title */}
          <div className="space-y-2">
            <h3 className="text-xl text-base-foreground">
              Add required tools for{" "}
              <span className="font-bold">
                {integration.friendlyName ?? integration.name}
              </span>{" "}
              or choose from connected ones
            </h3>
          </div>
        </div>

        {/* Warning at bottom left */}
        <div className="mt-auto">
          {!integration.verified && <IntegrationNotVerifiedAlert />}
        </div>
      </GridLeftColumn>

      {/* Right side: Configuration form */}
      <GridRightColumn>
        <IntegrationBindingForm schema={schema} formRef={formRef} />
      </GridRightColumn>
    </GridContainer>
  );
}

function AddConnectionDialogContent({
  title = "Add integration",
  filter,
  onSelect,
  forceTab,
  myConnectionsEmptyState,
  appName,
}: {
  title?: string;
  filter?: (integration: Integration) => boolean;
  onSelect?: (integration: Integration) => void;
  forceTab?: "my-connections" | "new-connection";
  myConnectionsEmptyState?: React.ReactNode;
  appName?: string;
}) {
  const [_tab, setTab] = useState<"my-connections" | "new-connection">(
    "my-connections",
  );
  const tab = forceTab ?? _tab;
  const [search, setSearch] = useState("");
  const createCustomConnection = useCreateCustomConnection();
  const { data: marketplace } = useMarketplaceIntegrations();
  const [installingIntegration, setInstallingIntegration] =
    useState<MarketplaceIntegration | null>(() => {
      if (!appName) return null;
      return (
        marketplace?.integrations.find(
          (integration) => integration.appName === appName,
        ) ?? null
      );
    });
  const [oauthCompletionDialog, setOauthCompletionDialog] = useState<{
    open: boolean;
    url: string;
    integrationName: string;
    connection: Integration | null;
  }>({ open: false, url: "", integrationName: "", connection: null });
  const navigateWorkspace = useNavigateWorkspace();
  const showEmptyState = search.length > 0;
  const { mutateAsync: getRegistryApp } = useGetRegistryApp();
  const handleInstallFromRegistry = async (appName: string) => {
    const app = await getRegistryApp({ name: appName ?? "" });
    setInstallingIntegration({
      ...app,
      name: AppName.build(app.scopeName, app.name),
      provider: "marketplace",
    });
  };

  useEffect(() => {
    if (appName) {
      handleInstallFromRegistry(appName);
    }
  }, [appName]);
  return (
    <DialogContent
      className="p-0 min-w-[80vw] min-h-[80vh] gap-0"
      closeButtonClassName="top-5 right-4"
    >
      <DialogHeader className="flex flex-row justify-between items-center p-2 h-14 px-5 pr-12">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="flex h-[calc(100vh-10rem)]">
        {!forceTab && (
          <aside className="w-56 flex flex-col p-4 gap-1">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-muted-foreground",
                tab === "my-connections" && "bg-muted text-foreground",
              )}
              onClick={() => setTab("my-connections")}
            >
              <Icon
                name="widgets"
                size={16}
                className="text-muted-foreground"
              />
              <span>My integrations</span>
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-muted-foreground",
                tab === "new-connection" && "bg-muted text-foreground",
              )}
              onClick={() => setTab("new-connection")}
            >
              <Icon name="add" size={16} className="text-muted-foreground" />
              <span>New integration</span>
            </Button>
            <Button
              variant="ghost"
              className={cn("w-full justify-start text-muted-foreground group")}
              onClick={() => navigateWorkspace("/connections")}
            >
              <Icon name="arrow_outward" size={16} />
              <span className="group-hover:underline">Manage integrations</span>
            </Button>
            {/* Filters will go here */}
          </aside>
        )}

        <div className="h-full overflow-y-hidden p-4 pb-20 w-full">
          <Input
            placeholder="Find integration..."
            value={search}
            className="mb-4"
            onChange={(e) => setSearch(e.target.value)}
          />
          {tab === "new-connection" && (
            <Marketplace
              filter={search}
              emptyState={
                <div className="flex flex-col h-full min-h-[200px] gap-4">
                  <div className="flex flex-col gap-2 py-8 w-full items-center">
                    <h3 className="text-2xl font-medium">
                      No integrations found for the search "{search}"
                    </h3>
                    <p className="text-sm text-muted-foreground w-full text-center">
                      You can{" "}
                      <Button
                        variant="link"
                        className="px-0"
                        onClick={() => setTab("my-connections")}
                      >
                        create a new custom integration
                      </Button>{" "}
                      instead.
                    </p>
                  </div>
                </div>
              }
              onClick={async (integration) => {
                if (integration.id === NEW_CUSTOM_CONNECTION.id) {
                  await createCustomConnection();
                  return;
                }
                setInstallingIntegration(integration);
              }}
            />
          )}
          {tab === "my-connections" && (
            <InstalledConnections
              query={search}
              emptyState={
                showEmptyState
                  ? (myConnectionsEmptyState ?? (
                      <div className="flex flex-col h-full min-h-[200px] gap-4 pb-16">
                        <div className="w-full flex items-center flex-col gap-2 py-8">
                          <h3 className="text-2xl font-medium">
                            No integrations found
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Create a new integration to get started
                          </p>
                        </div>
                        <Marketplace
                          filter={search}
                          emptyState={
                            <div className="flex flex-col gap-2 py-8 w-full items-center">
                              <p className="text-sm text-muted-foreground">
                                No integrations found for the search "{search}"
                              </p>
                            </div>
                          }
                          onClick={async (integration) => {
                            if (integration.id === NEW_CUSTOM_CONNECTION.id) {
                              await createCustomConnection();
                              return;
                            }
                            setInstallingIntegration(integration);
                          }}
                        />
                      </div>
                    ))
                  : null
              }
              filter={filter}
              onClick={(integration) => onSelect?.(integration)}
            />
          )}
        </div>
      </div>
      <ConfirmMarketplaceInstallDialog
        integration={installingIntegration}
        setIntegration={setInstallingIntegration}
        onConfirm={({ connection, authorizeOauthUrl }) => {
          if (authorizeOauthUrl) {
            const popup = globalThis.open(authorizeOauthUrl, "_blank");
            if (!popup || popup.closed || typeof popup.closed === "undefined") {
              setOauthCompletionDialog({
                open: true,
                url: authorizeOauthUrl,
                integrationName: installingIntegration?.name || "the service",
                connection: connection,
              });
            } else {
              onSelect?.(connection);
            }
          } else {
            onSelect?.(connection);
          }
        }}
      />

      <OAuthCompletionDialog
        open={oauthCompletionDialog.open}
        onOpenChange={(open) => {
          setOauthCompletionDialog((prev) => ({ ...prev, open }));
          if (oauthCompletionDialog.connection) {
            onSelect?.(oauthCompletionDialog.connection);
          }
        }}
        authorizeOauthUrl={oauthCompletionDialog.url}
        integrationName={oauthCompletionDialog.integrationName}
      />
    </DialogContent>
  );
}

interface SelectConnectionDialogProps {
  trigger?: React.ReactNode;
  title?: string;
  filter?: (integration: Integration) => boolean;
  onSelect?: (integration: Integration) => void;
  forceTab?: "my-connections" | "new-connection";
  myConnectionsEmptyState?: React.ReactNode;
}

export function SelectConnectionDialog(props: SelectConnectionDialogProps) {
  const [query] = useSearchParams();
  const appName = query.get("appName");
  const [isOpen, setIsOpen] = useState(!!appName);

  const trigger = useMemo(() => {
    if (props.trigger) {
      return props.trigger;
    }

    return (
      <Button variant="special">
        <span className="hidden md:inline">Add integration</span>
      </Button>
    );
  }, [props.trigger]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <AddConnectionDialogContent
        title={props.title}
        filter={props.filter}
        forceTab={props.forceTab}
        myConnectionsEmptyState={props.myConnectionsEmptyState}
        onSelect={(integration) => {
          props.onSelect?.(integration);
          setIsOpen(false);
        }}
        appName={appName ?? undefined}
      />
    </Dialog>
  );
}
