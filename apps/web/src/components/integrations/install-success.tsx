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

function ConnectionInstallSuccess() {
  const { mutateAsync: updateIntegration, isPending } = useUpdateIntegration({
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
  });
  const { data: allIntegrations } = useIntegrations();
  const [_loading, setLoading] = useState(true);

  const isLoading = isPending || _loading;

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(globalThis.location.search);
      const connectionId = searchParams.get("installId");
      const name = searchParams.get("name");
      const account = searchParams.get("account");
      if (connectionId) {
        const existingIntegration = allIntegrations?.find(
          (integration) => integration.id === connectionId,
        );
        if (existingIntegration) {
          const newName = name || `${existingIntegration.name} | ${account}` ||
            existingIntegration.name;
          const newDescription = account || existingIntegration.description;
          updateIntegration({
            ...existingIntegration,
            id: connectionId,
            name: newName,
            description: newDescription,
          });
        }

        searchParams.delete("installId");
        const newUrl =
          `${globalThis.location.pathname}?${searchParams.toString()}`;
        globalThis.history.replaceState({}, "", newUrl);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [updateIntegration, allIntegrations]);

  return (
    <div className="min-h-screen h-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-4 rounded-xl">
        {isLoading
          ? (
            <CardContent className="text-center space-y-4 py-8">
              <Spinner size="lg" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Processing Integration</h3>
                <p className="text-muted-foreground">
                  Please wait while we set up your integration...
                </p>
              </div>
            </CardContent>
          )
          : (
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
