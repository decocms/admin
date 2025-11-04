import { useEffect, useState } from "react";
import { onMcpAuthorization } from "use-mcp";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/web/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { fetcher } from "@/tools/client";

/**
 * Helper function to find the OAuth token in localStorage
 * use-mcp stores tokens with keys like "mcp:auth_*_tokens" or "mcp:auth:*:token"
 */
function findTokenInStorage(storageKeyPrefix: string): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      key.startsWith(storageKeyPrefix) &&
      (key.endsWith("_tokens") ||
        key.endsWith(":token") ||
        key.endsWith(":tokens"))
    ) {
      const tokenData = localStorage.getItem(key);
      if (tokenData) {
        try {
          const parsed = JSON.parse(tokenData);
          return parsed.access_token || parsed.accessToken || tokenData;
        } catch {
          // If not JSON, return as-is
          return tokenData;
        }
      }
    }
  }
  return null;
}

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

          // Extract connection context from localStorage and save the token
          const pendingAuth = localStorage.getItem("mcp_oauth_pending");
          if (pendingAuth) {
            try {
              const { connectionId, connectionType, connectionUrl } =
                JSON.parse(pendingAuth);

              // Find the token in localStorage (use-mcp stores it with key pattern: "mcp:auth:*:token")
              const token = findTokenInStorage("mcp:auth");

              if (token && connectionId) {
                console.log(
                  "[OAuth Callback] Found token, saving to connection...",
                );

                // Call CONNECTION_UPDATE to save the token
                await fetcher.CONNECTION_UPDATE({
                  id: connectionId,
                  connection: {
                    type: connectionType,
                    url: connectionUrl,
                    token: token,
                  },
                });

                console.log(
                  "[OAuth Callback] Token saved to connection successfully",
                );
              } else {
                console.warn(
                  "[OAuth Callback] Token or connectionId not found",
                  { token: !!token, connectionId },
                );
              }

              // Clear pending auth from storage
              localStorage.removeItem("mcp_oauth_pending");
            } catch (saveErr) {
              console.error("[OAuth Callback] Failed to save token:", saveErr);
              // Don't set error state - token is saved in localStorage, user can retry
            }
          } else {
            console.log("[OAuth Callback] No pending auth context found");
          }

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
              <p className="text-destructive">{error}</p>
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
