import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { authClient } from "./lib/auth-client.ts";
import { useNavigate, Link } from "react-router-dom";

export function Providers({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={navigate}
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
