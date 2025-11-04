import { Link, useNavigate } from "@tanstack/react-router";

import { authClient } from "../lib/auth-client";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";

export function BetterAuthUIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <AuthUIProvider
      authClient={authClient}
      organization={{
        basePath: "/",
        pathMode: "default",
      }}
      navigate={(href) => navigate({ to: href })}
      Link={({ href, className, children, ...props }) => (
        <Link to={href} className={className} {...props}>
          {children}
        </Link>
      )}
    >
      {children}
    </AuthUIProvider>
  );
}
