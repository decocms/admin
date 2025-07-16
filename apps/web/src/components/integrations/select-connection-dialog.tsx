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
import React from "react";
import {
  Marketplace,
  type MarketplaceIntegration,
  NEW_CUSTOM_CONNECTION,
} from "./marketplace.tsx";
import type { Integration } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";
import { InstalledConnections } from "./installed-connections.tsx";
import { useCreateCustomConnection } from "../../hooks/use-create-custom-connection.ts";
import { trackEvent } from "../../hooks/analytics.ts";
import { IntegrationIcon } from "./common.tsx";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import { OAuthCompletionDialog } from "./oauth-completion-dialog.tsx";
import { useIntegrationInstallWithModal } from "../../hooks/use-integration-install-with-modal.tsx";
import { IntegrationOAuthModal } from "../integration-oauth-modal.tsx";
import { useMarketplaceIntegrations } from "@deco/sdk";
import { IntegrationDetailView } from "./integration-detail-view.tsx";

// Define categories based on providers and known integrations
const INTEGRATION_CATEGORIES = {
  deco: {
    label: "Deco Apps",
    icon: "verified",
    description: "Official integrations built by Deco"
  },
  composio: {
    label: "Composio",
    icon: "extension",
    description: "Productivity and business apps"
  },
  wppagent: {
    label: "Communication",
    icon: "chat",
    description: "Messaging and communication tools"
  },
  custom: {
    label: "Custom",
    icon: "code",
    description: "User-created integrations"
  },
  unknown: {
    label: "Third Party",
    icon: "public",
    description: "External service integrations"
  }
} as const;

type CategoryKey = keyof typeof INTEGRATION_CATEGORIES;

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
  const { install, modalState, isLoading } = useIntegrationInstallWithModal();
  const buildWorkspaceUrl = useWorkspaceLink();

  const handleConnect = async () => {
    if (!integration) return;

    const returnUrl = new URL(
      buildWorkspaceUrl("/connections/success"),
      globalThis.location.origin,
    );

    try {
      const result = await install({
        appId: integration.id,
        appName: integration.name,
        provider: integration.provider,
        returnUrl: returnUrl.href,
      });

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
      }
    } catch (error) {
      trackEvent("integration_install", {
        success: false,
        data: integration,
        error,
      });
    }
  };

  const handleModalComplete = async (formData: Record<string, unknown>) => {
    // Handle the form submission from the modal
    await modalState.onSubmit(formData);

    // After successful form submission, call onConfirm with the integration
    if (modalState.integration) {
      onConfirm({
        connection: modalState.integration,
        authorizeOauthUrl: null,
      });
      setIntegration(null);
    }
  };

  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={() => setIntegration(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Connect to {integration.friendlyName ?? integration.name}
          </DialogTitle>
          <DialogDescription>
            <div className="mt-4">
              <div className="grid grid-cols-[80px_1fr] items-start gap-4">
                <IntegrationIcon
                  icon={integration?.icon}
                  name={integration?.friendlyName ?? integration?.name}
                />
                <div>
                  <div className="text-sm text-muted-foreground">
                    {integration?.description}
                  </div>
                </div>
              </div>
              {!integration.verified && (
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
          {isLoading
            ? (
              <Button disabled={isLoading}>
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

      {/* Modal for JSON Schema form */}
      {modalState.schema && (
        <IntegrationOAuthModal
          isOpen={modalState.isOpen}
          onClose={modalState.onClose}
          schema={modalState.schema}
          integrationName={modalState.integrationName || integration?.name ||
            "Integration"}
          permissions={modalState.permissions || []}
          onSubmit={handleModalComplete}
          isLoading={modalState.isLoading}
        />
      )}
    </Dialog>
  );
}

function AddConnectionDialogContent({
  title = "Add integration",
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
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<MarketplaceIntegration | null>(null);
  const createCustomConnection = useCreateCustomConnection();
  const [installingIntegration, setInstallingIntegration] = useState<
    MarketplaceIntegration | null
  >(null);
  const [oauthCompletionDialog, setOauthCompletionDialog] = useState<{
    open: boolean;
    url: string;
    integrationName: string;
  }>({ open: false, url: "", integrationName: "" });
  const navigateWorkspace = useNavigateWorkspace();
  const showEmptyState = search.length > 0;
  
  const { data: marketplace } = useMarketplaceIntegrations();

  // Get category counts for display
  const categoryCounts = useMemo(() => {
    if (!marketplace?.integrations) return {};
    
    const counts: Record<CategoryKey | 'all', number> = {
      all: marketplace.integrations.length + 1, // +1 for custom connection
      deco: 0,
      composio: 0,
      wppagent: 0,
      custom: 0,
      unknown: 0,
    };

    marketplace.integrations.forEach((integration) => {
      const category = integration.provider as CategoryKey;
      if (category in counts) {
        counts[category]++;
      } else {
        counts.unknown++;
      }
    });

    return counts;
  }, [marketplace]);

  const handleIntegrationClick = (integration: MarketplaceIntegration) => {
    if (integration.id === NEW_CUSTOM_CONNECTION.id) {
      createCustomConnection();
      return;
    }
    setSelectedIntegration(integration);
  };

  const handleInstallIntegration = (integration: MarketplaceIntegration) => {
    setInstallingIntegration(integration);
    setSelectedIntegration(null);
  };

  const handleBackToList = () => {
    setSelectedIntegration(null);
  };



  return (
    <DialogContent
      className="p-0 min-w-[80vw] min-h-[80vh] gap-0"
      closeButtonClassName="top-5 right-4"
    >
      <DialogHeader className="flex flex-row justify-between items-center p-2 h-14 px-5 pr-12">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="flex h-[calc(100vh-10rem)]">
                 {/* Categories Sidebar */}
         <aside className="w-64 flex flex-col bg-muted/20">
           {/* Tab Selection */}
           {!forceTab && (
             <div className="p-4">
               <div className="space-y-1">
                 <Button
                   variant="ghost"
                   className={cn(
                     "w-full justify-start",
                     tab === "my-connections" && "bg-muted text-foreground",
                   )}
                   onClick={() => setTab("my-connections")}
                 >
                   <span>My integrations</span>
                 </Button>
                 <Button
                   variant="ghost"
                   className={cn(
                     "w-full justify-start",
                     tab === "new-connection" && "bg-muted text-foreground",
                   )}
                   onClick={() => setTab("new-connection")}
                 >
                   <span>Browse marketplace</span>
                 </Button>
               </div>
             </div>
           )}

           {/* Categories - only show in marketplace tab */}
           {tab === "new-connection" && (
             <div className="flex-1 px-4 pb-4">
               <div className="space-y-1">
                 <Button
                   variant="ghost"
                   className={cn(
                     "w-full justify-between",
                     selectedCategory === 'all' && "bg-muted text-foreground",
                   )}
                   onClick={() => setSelectedCategory('all')}
                 >
                   <span>All</span>
                   <span className="text-xs text-muted-foreground">
                     {categoryCounts.all}
                   </span>
                 </Button>
                 
                 {Object.entries(INTEGRATION_CATEGORIES).map(([key, category]) => (
                   <Button
                     key={key}
                     variant="ghost"
                     className={cn(
                       "w-full justify-between",
                       selectedCategory === key && "bg-muted text-foreground",
                     )}
                     onClick={() => setSelectedCategory(key as CategoryKey)}
                   >
                     <span>{category.label}</span>
                     <span className="text-xs text-muted-foreground">
                       {categoryCounts[key as CategoryKey] || 0}
                     </span>
                   </Button>
                 ))}
               </div>
             </div>
           )}
         </aside>

                 {/* Main Content */}
         <div className="flex-1 flex flex-col">
           {/* Search */}
           <div className="p-4">
             <Input
               placeholder="Find integration..."
               value={search}
               className="w-full"
               onChange={(e) => setSearch(e.target.value)}
             />
           </div>

                      {/* Content Area */}
           <div className="flex-1 overflow-y-auto p-4">
             {selectedIntegration && tab === "new-connection" ? (
               <IntegrationDetailView
                 integration={selectedIntegration}
                 onBack={handleBackToList}
                 onInstall={handleInstallIntegration}
               />
             ) : (
               <>
                 {tab === "new-connection" && (
                   <Marketplace
                     filter={search}
                     categoryFilter={selectedCategory}
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
                     onClick={handleIntegrationClick}
                   />
                 )}
                 {tab === "my-connections" && (
                   <InstalledConnections
                     query={search}
                     emptyState={showEmptyState
                       ? myConnectionsEmptyState ?? (
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
                             onClick={handleIntegrationClick}
                           />
                         </div>
                       )
                       : null}
                     filter={filter}
                     onClick={(integration) => onSelect?.(integration)}
                   />
                 )}
               </>
             )}
           </div>
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
              setOauthCompletionDialog({
                open: true,
                url: authorizeOauthUrl,
                integrationName: installingIntegration?.name || "the service",
              });
            }
          }
        }}
      />

      <OAuthCompletionDialog
        open={oauthCompletionDialog.open}
        onOpenChange={(open) =>
          setOauthCompletionDialog((prev) => ({ ...prev, open }))}
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
  const [isOpen, setIsOpen] = useState(false);
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
