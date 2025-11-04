import { useEffect } from "react";
import { useAuthConfig } from "../providers/auth-config-provider";
import { SplashScreen } from "../components/splash-screen";
import { authClient } from "../lib/auth-client";
import { Navigate, useSearch } from "@tanstack/react-router";

function RunSSO({
  callbackURL,
  providerId,
}: {
  providerId: string;
  callbackURL: string;
}) {
  useEffect(() => {
    (async () => {
      await authClient.signIn.sso({
        providerId,
        callbackURL,
      });
    })();
  }, [providerId, callbackURL]);

  return <SplashScreen />;
}

export default function LoginRoute() {
  const session = authClient.useSession();
  const { next = "/" } = useSearch({ from: "/login" });
  const { sso } = useAuthConfig();

  if (session.data) {
    return <Navigate to={next} />;
  }

  if (sso.enabled) {
    return <RunSSO callbackURL={next} providerId={sso.providerId} />;
  }

  return <div>No login options available</div>;
}
