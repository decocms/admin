import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { authClient } from "@/web/lib/auth-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthConfigProvider } from "./auth-config-provider";
import { Link, useNavigate } from "@tanstack/react-router";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthConfigProvider>
        <AuthUIProvider
          authClient={authClient}
          navigate={(href) => navigate({ to: href })}
          Link={({ href, className, children, ...props }) => (
            <Link to={href} className={className} {...props}>
              {children}
            </Link>
          )}
        >
          {children}
        </AuthUIProvider>
      </AuthConfigProvider>
    </QueryClientProvider>
  );
}
