import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useMemo, useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Marketplace,
  MarketplaceIntegration,
  NEW_CUSTOM_CONNECTION,
} from "./marketplace.tsx";
import { Integration, useInstallFromMarketplace } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";
import { InstalledConnections } from "./installed-connections.tsx";
import { useCreateCustomConnection } from "../../hooks/use-create-custom-connection.ts";
import { trackEvent } from "../../hooks/analytics.ts";
import { IntegrationIcon } from "./common.tsx";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";

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
  const { mutate: installIntegration } = useInstallFromMarketplace();
  const [isPending, setIsPending] = useState(false);
  const buildWorkspaceUrl = useWorkspaceLink();

  const handleConnect = () => {
    if (!integration) return;
    setIsPending(true);
    const returnUrl = new URL(
      buildWorkspaceUrl("/connections/success"),
      globalThis.location.origin,
    );

    installIntegration({
      appName: integration.id,
      provider: integration.provider,
      returnUrl: returnUrl.href,
    }, {
      onSuccess: ({ integration: installedIntegration, redirectUrl }) => {
        if (typeof installedIntegration?.id !== "string") {
          setIsPending(false);
          return;
        }

        setIsPending(false);
        trackEvent("integration_install", {
          success: true,
          data: integration,
        });
        onConfirm({
          connection: installedIntegration,
          authorizeOauthUrl: redirectUrl ?? null,
        });
        setIntegration(null);
      },
      onError: (error) => {
        setIsPending(false);
        trackEvent("integration_install", {
          success: false,
          data: integration,
          error,
        });
      },
    });
  };

  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={() => setIntegration(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Connect to {integration.name}
          </DialogTitle>
          <DialogDescription>
            <div className="mt-4">
              <div className="grid grid-cols-[80px_1fr] items-start gap-4">
                <IntegrationIcon
                  icon={integration?.icon}
                  name={integration?.name || ""}
                />
                <div>
                  <div className="text-sm text-muted-foreground">
                    {integration?.description}
                  </div>
                </div>
              </div>
              {integration.provider !== "deco" && (
                <div className="mt-4 p-3 bg-accent border border-border rounded-xl text-sm">
                  <div className="flex items-center gap-2">
                    <Icon name="info" size={16} />
                    <span className="font-medium">
                      Third-party integration
                    </span>
                  </div>
                  <p className="mt-1">
                    This integration is provided by a third party and is not
                    maintained by deco.
                    <br />
                    Provider:{" "}
                    <span className="font-medium">{integration.provider}</span>
                  </p>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {isPending
            ? (
              <Button disabled={isPending}>
                Connecting...
              </Button>
            )
            : (
              <Button onClick={handleConnect}>
                Connect
              </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddConnectionDialogContent({
  title = "Add connection",
  filter,
  onSelect,
  forceTab,
  myConnectionsEmptyState,
}: {
  title?: string;
  filter?: (integration: Integration) => boolean;
  onSelect?: (integration: Integration) => void;
  forceTab?: "my-connections" | "new-connection";
  myConnectionsEmptyState?: React.ReactNode;
}) {
  const [_tab, setTab] = useState<"my-connections" | "new-connection">(
    "my-connections",
  );
  const tab = forceTab ?? _tab;
  const [search, setSearch] = useState("");
  const createCustomConnection = useCreateCustomConnection();
  const [installingIntegration, setInstallingIntegration] = useState<
    MarketplaceIntegration | null
  >(null);
  const navigateWorkspace = useNavigateWorkspace();
  const showEmptyState = search.length > 0;

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
              <span>My connections</span>
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
              <span>New connection</span>
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-muted-foreground group",
              )}
              onClick={() => navigateWorkspace("/connections")}
            >
              <Icon name="arrow_outward" size={16} />
              <span className="group-hover:underline">Manage connections</span>
            </Button>
            {/* Filters will go here */}
          </aside>
        )}

        <div className="h-full overflow-y-hidden p-4 pb-20 w-full">
          <Input
            placeholder="Find connection..."
            value={search}
            className="mb-4"
            onChange={(e) => setSearch(e.target.value)}
          />
          {tab === "new-connection" && (
            <Marketplace
              filter={search}
              emptyState={
                <div className="flex flex-col h-full min-h-[200px] gap-4">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold">
                      No connections found for the search "{search}" in the
                      marketplace
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      You can{" "}
                      <Button
                        variant="link"
                        className="px-0"
                        onClick={() => setTab("my-connections")}
                      >
                        create a new custom connection
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
              emptyState={showEmptyState
                ? myConnectionsEmptyState ?? (
                  <div className="flex flex-col h-full min-h-[200px] gap-4 pb-16">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-semibold">
                        No connections found for the search "{search}" in your
                        team
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        You can install a connection from the marketplace to get
                        started:
                      </p>
                    </div>
                    <Marketplace
                      filter={search}
                      emptyState={
                        <div className="flex flex-col gap-2">
                          <p className="text-sm text-muted-foreground">
                            No connections found for the search "{search}" on
                            the marketplace
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
                )
                : null}
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
          onSelect?.(connection);
          if (authorizeOauthUrl) {
            const popup = globalThis.open(
              authorizeOauthUrl,
              "_blank",
            );
            if (!popup || popup.closed || typeof popup.closed === "undefined") {
              alert(
                "Please allow popups for this site to complete the OAuth flow.",
              );
              const link = document.createElement("a");
              link.href = authorizeOauthUrl;
              link.target = "_blank";
              link.textContent = "Click here to continue OAuth flow";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }
        }}
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
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useMemo(() => {
    if (props.trigger) {
      return props.trigger;
    }

    return (
      <Button variant="special">
        <span className="hidden md:inline">Add connection</span>
      </Button>
    );
  }, [props.trigger]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <AddConnectionDialogContent
        title={props.title}
        filter={props.filter}
        forceTab={props.forceTab}
        myConnectionsEmptyState={props.myConnectionsEmptyState}
        onSelect={(integration) => {
          props.onSelect?.(integration);
          setIsOpen(false);
        }}
      />
    </Dialog>
  );
}
