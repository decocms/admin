import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { useEffect, useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useIntegrations, useUpdateIntegration } from "@deco/sdk";
import { trackException } from "../../hooks/analytics.ts";
import { notifyIntegrationUpdate } from "../../lib/broadcast-channels.ts";
import {
  useThreadManager,
  buildAppUri,
} from "../decopilot/thread-context-manager.tsx";
import { AppKeys, getConnectionAppKey } from "./apps.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

function ConnectionInstallSuccess() {
  const { addTab } = useThreadManager();
  const navigateWorkspace = useNavigateWorkspace();
  const [integrationUpdated, setIntegrationUpdated] = useState(false);
  const [storedInstallId, setStoredInstallId] = useState<string | null>(null);
  const { mutate: updateIntegration, isPending } = useUpdateIntegration({
    onError: (error) => {
      const searchParams = new URLSearchParams(globalThis.location.search);
      trackException(error, {
        properties: {
          installId: searchParams.get("installId"),
          appName: searchParams.get("appName"),
          mcpUrl: searchParams.get("mcpUrl"),
          name: searchParams.get("name"),
          account: searchParams.get("account"),
        },
      });
    },
    onSuccess: () => {
      const searchParams = new URLSearchParams(globalThis.location.search);
      const installId = searchParams.get("installId");

      // Store installId before removing it from URL
      if (installId) {
        setStoredInstallId(installId);
      }

      searchParams.delete("installId");
      const newUrl = `${globalThis.location.pathname}?${searchParams.toString()}`;
      globalThis.history.replaceState({}, "", newUrl);

      // Notify other windows about the successful update
      notifyIntegrationUpdate();

      // Mark that integration was updated so we can add it to tab
      setIntegrationUpdated(true);
    },
  });
  const { data: allIntegrations } = useIntegrations();

  useEffect(() => {
    const searchParams = new URLSearchParams(globalThis.location.search);
    const installId = searchParams.get("installId");
    const name = searchParams.get("name");
    const account = searchParams.get("account");

    if (!installId || !allIntegrations) {
      return;
    }

    const connectionId = `i:${installId}`;
    const existingIntegration = allIntegrations.find(
      (integration) => integration.id === connectionId,
    );

    if (!existingIntegration) {
      return;
    }

    // Construct name: use provided name, or combine app name with account if available
    const newName =
      name ||
      (account
        ? `${existingIntegration.name} | ${account}`
        : existingIntegration.name);

    // Use account as description if provided, otherwise keep existing
    const newDescription = account || existingIntegration.description;
    if (existingIntegration.connection.type === "HTTP") {
      existingIntegration.connection.token = installId;
    }

    updateIntegration({
      ...existingIntegration,
      id: connectionId,
      name: newName,
      description: newDescription,
    });
  }, [updateIntegration, allIntegrations]);

  // Add app to tab and focus it after integration is updated
  useEffect(() => {
    if (!integrationUpdated || !allIntegrations || !storedInstallId) {
      return;
    }

    const connectionId = `i:${storedInstallId}`;
    const integration = allIntegrations.find((i) => i.id === connectionId);

    if (integration) {
      const key = getConnectionAppKey(integration);
      const appKey = AppKeys.build(key);

      // Add tab for the app (addTab automatically sets it as active)
      addTab({
        type: "detail",
        resourceUri: buildAppUri(appKey),
        title: integration.name,
        icon: integration.icon,
      });

      // Navigate away from success page
      navigateWorkspace("/apps");
    }
  }, [
    integrationUpdated,
    allIntegrations,
    storedInstallId,
    addTab,
    navigateWorkspace,
  ]);

  return (
    <div className="min-h-screen h-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-4 rounded-xl">
        {isPending ? (
          <CardContent className="text-center space-y-4 py-8">
            <div className="flex justify-center w-full">
              <Spinner size="lg" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Processing Integration</h3>
              <p className="text-muted-foreground">
                Please wait while we set up your integration...
              </p>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center">
              <Icon name="check_circle" size={36} className="text-special" />
              <CardTitle className="text-xl font-medium">
                Integration Connected Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Your integration has been successfully connected.
              </p>
              <p className="text-muted-foreground">
                You can now close this window.
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

export default ConnectionInstallSuccess;
