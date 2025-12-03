import { useEffect } from "react";
import { useAuthConfig } from "@/web/providers/auth-config-provider";
import { SplashScreen } from "@/web/components/splash-screen";
import { authClient } from "@/web/lib/auth-client";
import { Navigate, useSearch } from "@tanstack/react-router";
import { UnifiedAuthForm } from "@/web/components/unified-auth-form";

function RunSSO({
  callbackURL,
  providerId,
}: {
  providerId: string;
  callbackURL: string;
}) {
  // oxlint-disable-next-line ban-use-effect/ban-use-effect
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
  const { sso, emailAndPassword, magicLink, socialProviders } = useAuthConfig();

  if (session.data) {
    return <Navigate to={next} />;
  }

  if (sso.enabled) {
    return <RunSSO callbackURL={next} providerId={sso.providerId} />;
  }

  // Render unified auth form if any standard auth method is enabled
  if (
    emailAndPassword.enabled ||
    magicLink.enabled ||
    socialProviders.enabled
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <UnifiedAuthForm />
      </main>
    );
  }

  return <div>No login options available</div>;
}
