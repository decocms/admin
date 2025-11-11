import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  useIntegrations,
  useUpdateIntegration,
  type Integration,
} from "@deco/sdk";
import { trackException } from "../../hooks/analytics.ts";
import { useThread, buildAppUri } from "../decopilot/thread-provider.tsx";
import { AppKeys, getConnectionAppKey } from "./apps.ts";
import { useSearchParams } from "react-router";
import { IntegrationIcon } from "./common.tsx";

type ComponentState = "loading" | "success" | "error";

export default function OAuthSuccess() {
  const [searchParams] = useSearchParams();
  const { data: allIntegrations } = useIntegrations();
  const { addTab } = useThread();
  const hasTriggeredUpdate = useRef(false);

  // Component state
  const [state, setState] = useState<ComponentState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [connectedIntegration, setConnectedIntegration] =
    useState<Integration | null>(null);

  // Extract search params
  const installId = searchParams.get("installId");
  const name = searchParams.get("name");
  const account = searchParams.get("account");

  const { mutate: updateIntegration } = useUpdateIntegration({
    onError: (error) => {
      console.error("[OAuthSuccess] Update integration failed:", error);
      trackException(error, {
        properties: {
          installId,
          name,
          account,
        },
      });
      setState("error");
      setErrorMessage(
        "Failed to update integration. Please try connecting again.",
      );
    },
    onSuccess: (integration) => {
      console.log(
        "[OAuthSuccess] Integration updated successfully:",
        integration,
      );
      setState("success");
      setConnectedIntegration(integration);

      // Open the app in a new tab
      const key = getConnectionAppKey(integration);
      const appKey = AppKeys.build(key);
      console.log("[OAuthSuccess] Opening app in tab:", { key, appKey });

      addTab({
        type: "detail",
        resourceUri: buildAppUri(appKey),
        title: integration.name,
        icon: integration.icon,
      });
    },
  });

  console.log("[OAuthSuccess] Render with params:", {
    installId,
    name,
    account,
    hasIntegrations: !!allIntegrations,
    integrationsCount: allIntegrations?.length,
    hasTriggeredUpdate: hasTriggeredUpdate.current,
    currentState: state,
  });

  // Trigger update when integration is found
  const connectionId = installId ? `i:${installId}` : null;
  const existingIntegration = useMemo(() => {
    if (!connectionId || !allIntegrations) return null;

    console.log("[OAuthSuccess] Looking for integration:", connectionId);
    console.log(
      "[OAuthSuccess] Available IDs:",
      allIntegrations.map((i) => i.id),
    );

    const found = allIntegrations.find(
      (integration) => integration.id === connectionId,
    );
    console.log("[OAuthSuccess] Found existing integration:", found);
    return found;
  }, [connectionId, allIntegrations]);

  // Check for initial errors before attempting update
  useEffect(() => {
    if (!installId) {
      console.error("[OAuthSuccess] Missing installId parameter");
      setState("error");
      setErrorMessage("Missing installation ID. Invalid OAuth callback.");
      return;
    }

    if (allIntegrations && !existingIntegration) {
      console.error(
        "[OAuthSuccess] Integration not found with ID:",
        connectionId,
      );
      setState("error");
      setErrorMessage(
        "Integration not found. It may have been deleted or the installation ID is invalid.",
      );
    }
  }, [installId, allIntegrations, existingIntegration, connectionId]);

  // Trigger update when integration is found
  useEffect(() => {
    if (!existingIntegration) {
      console.log("[OAuthSuccess] No integration yet, waiting...");
      return;
    }

    if (hasTriggeredUpdate.current) {
      console.log("[OAuthSuccess] Update already triggered, skipping");
      return;
    }

    // Ensure we have a valid connectionId and installId
    if (!connectionId || !installId) {
      console.error("[OAuthSuccess] Missing connectionId or installId");
      return;
    }

    console.log("[OAuthSuccess] Triggering integration update via useEffect");
    hasTriggeredUpdate.current = true;

    // Type-safe values after null check
    const safeConnectionId: string = connectionId;
    const safeInstallId: string = installId;

    // Construct name: use provided name, or combine app name with account if available
    const newName =
      name ||
      (account
        ? `${existingIntegration.name} | ${account}`
        : existingIntegration.name);

    // Use account as description if provided, otherwise keep existing
    const newDescription = account || existingIntegration.description;

    // Set the token to the installId for HTTP connections
    const updatedConnection = { ...existingIntegration.connection };
    if (updatedConnection.type === "HTTP") {
      console.log("[OAuthSuccess] Setting token for HTTP connection");
      updatedConnection.token = safeInstallId;
    } else {
      console.log(
        "[OAuthSuccess] Connection type is not HTTP:",
        updatedConnection.type,
      );
    }

    const updatePayload = {
      ...existingIntegration,
      id: safeConnectionId,
      name: newName,
      description: newDescription,
      connection: updatedConnection,
    };

    console.log("[OAuthSuccess] Update payload:", updatePayload);
    updateIntegration(updatePayload);
    console.log("[OAuthSuccess] Mutation triggered, waiting for response...");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingIntegration, name, account, connectionId, installId]);

  console.log("[OAuthSuccess] Current state:", state);

  return (
    <div className="min-h-screen h-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-4 rounded-xl">
        {state === "loading" && (
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
        )}

        {state === "success" && connectedIntegration && (
          <>
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <Icon name="check_circle" size={48} className="text-special" />
              </div>
              <CardTitle className="text-xl font-medium">
                Integration Connected Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="flex flex-col items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <IntegrationIcon
                  icon={connectedIntegration.icon}
                  name={connectedIntegration.name}
                  size="lg"
                />
                <div>
                  <p className="font-medium text-lg">
                    {connectedIntegration.name}
                  </p>
                  {connectedIntegration.description && (
                    <p className="text-sm text-muted-foreground">
                      {connectedIntegration.description}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground">
                Your integration is now ready to use.
              </p>
              <p className="text-sm text-muted-foreground">
                You can now close this tab.
              </p>
            </CardContent>
          </>
        )}

        {state === "error" && (
          <>
            <CardHeader className="text-center">
              <Icon name="error" size={36} className="text-destructive" />
              <CardTitle className="text-xl font-medium">
                Connection Failed
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">{errorMessage}</p>
              <p className="text-sm text-muted-foreground">
                You can close this tab and try again.
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
