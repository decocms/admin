import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { useEffect, useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { trackException } from "../../hooks/analytics.ts";
import { notifyOAuthMessage } from "../../lib/broadcast-channels.ts";
import { useMutation } from "@tanstack/react-query";

function OAuthInstallSuccess() {
  const [state, setState] = useState<"pending" | "success" | "error">(
    "pending",
  );
  const { mutate: notifyCompletionDeduped } = useMutation({
    mutationKey: ["oauth-install-success"],
    mutationFn: () => {
      const searchParams = new URLSearchParams(globalThis.location.search);
      const installId = searchParams.get("installId");
      const name = searchParams.get("name");
      const account = searchParams.get("account");

      if (!installId) {
        notifyOAuthMessage({
          type: "OAUTH_ERROR",
          error: "No installId found in query params",
          installId: "",
        });
        throw new Error("No installId found in query params");
      }

      // make sure this only runs once per installId
      if (
        localStorage.getItem(`oauth-install-success-${installId}`) === "true"
      ) {
        return Promise.resolve();
      }
      notifyOAuthMessage({
        type: "OAUTH_FINISHED",
        installId,
        name,
        account,
      });
      localStorage.setItem(`oauth-install-success-${installId}`, "true");
      return Promise.resolve();
    },
    onSuccess: () => {
      setState("success");
    },
    onError: (error) => {
      trackException(error, {
        properties: {
          url: globalThis.location.href,
        },
      });
      setState("error");
      return;
    },
  });

  // sad to do this, but it is the way i've found to do this on page load on an SPA.
  // eventually we should make a redirect to our API instead of having a /connection/success
  // route on the frontend.
  useEffect(notifyCompletionDeduped, [notifyCompletionDeduped]);

  return (
    <div className="min-h-screen h-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-4 rounded-xl">
        {state === "pending"
          ? (
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
          )
          : state === "success"
          ? (
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
          )
          : (
            <>
              <CardHeader className="text-center">
                <Icon name="error" size={36} className="text-destructive" />
                <CardTitle className="text-xl font-medium">
                  Error Connecting Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">
                  We were unable to connect your integration. Please try again.
                </p>
              </CardContent>
            </>
          )}
      </Card>
    </div>
  );
}

export default OAuthInstallSuccess;
