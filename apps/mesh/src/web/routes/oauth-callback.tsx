import { useEffect, useState } from "react";
import { onMcpAuthorization } from "use-mcp";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/web/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function OAuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle the OAuth callback
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        let state = params.get("state");
        const errorParam = params.get("error");
        const errorDescription = params.get("error_description");

        if (errorParam) {
          console.error("OAuth error:", errorParam, errorDescription);
          setError(errorDescription || errorParam);
          // Show error and close window after delay
          setTimeout(() => {
            window.close();
          }, 3000);
          return;
        }

        if (code && state) {
          // Check if the state is a base64-encoded JSON object from deco.cx
          // deco.cx wraps the original state in additional metadata
          try {
            const decodedState = atob(state);
            const stateObj = JSON.parse(decodedState);

            // If the state contains a nested clientState, extract it
            if (stateObj.clientState) {
              console.log("[OAuth Callback] Unwrapping deco.cx state wrapper");
              console.log("  Original state:", state);
              console.log("  Extracted clientState:", stateObj.clientState);

              // Replace the state parameter with the actual client state
              const url = new URL(window.location.href);
              url.searchParams.set("state", stateObj.clientState);

              // Update the browser URL without reloading
              window.history.replaceState({}, "", url.toString());

              // Update state for the authorization call
              state = stateObj.clientState;
            }
          } catch (e) {
            // If decoding/parsing fails, use the state as-is
            console.log("[OAuth Callback] Using state as-is (not wrapped)");
          }

          // Let use-mcp handle the authorization with the unwrapped state
          await onMcpAuthorization();

          // Close the window after a short delay
          setTimeout(() => {
            window.close();
          }, 2000);
        }
      } catch (err) {
        console.error("[OAuth Callback] Error:", err);
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => {
          window.close();
        }, 3000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {error ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                Authentication Failed
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Authentication Successful
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">An error occurred during authentication:</p>
              <p className="text-destructive">
                {params.get("error_description") || error}
              </p>
              <p className="mt-4">This window will close automatically.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Authentication complete. This window will close automatically.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
