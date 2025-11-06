import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthConfigProvider } from "@/web/providers/auth-config-provider";
import { BetterAuthUIProvider } from "@/web/providers/better-auth-ui-provider";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthConfigProvider>
        <BetterAuthUIProvider>{children}</BetterAuthUIProvider>
      </AuthConfigProvider>
    </QueryClientProvider>
  );
}
