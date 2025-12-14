import { useState, useEffect } from "react";
import { isOAuthTokenValid } from "@/web/lib/browser-oauth-provider";

/**
 * Hook to verify if an OAuth token is valid
 * @param connectionUrl - Connection URL
 * @param connectionToken - Connection token
 * @returns isOauthNecessary - true if OAuth is necessary (invalid or missing token)
 */
export function useOAuthTokenValidation(
  connectionUrl: string | undefined,
  connectionToken?: string | null,
) {
  const [isOauthNecessary, setIsOauthNecessary] = useState(false);

  if (!connectionUrl) {
    return { isOauthNecessary: false };
  }

  // oxlint-disable-next-line ban-use-effect/ban-use-effect
  useEffect(() => {
    const checkOauth = async () => {
      const isTokenValid = await isOAuthTokenValid(
        connectionUrl,
        connectionToken ?? "",
      );
      setIsOauthNecessary(!isTokenValid);
    };
    checkOauth();
  }, [connectionUrl, connectionToken]);

  return { isOauthNecessary };
}
