import { OrganizationSwitcher } from "@daveyplate/better-auth-ui";
import { authClient } from "./lib/auth-client";
import { OrganizationsHome } from "./organizations-home";
import { useAuthConfig } from "./auth-config-provider";
import { useEffect } from "react";

export default function App() {
  const { ssoEnabled } = useAuthConfig();
  const session = authClient.useSession();

  // Auto-redirect to SSO if enabled and user is not authenticated
  useEffect(() => {
    if (ssoEnabled && !session.data) {
      authClient.signIn.sso({
        callbackURL: `/`,
      });
    }
  }, [ssoEnabled, session.data]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Deco CMS Admin - Self Hosted</h1>
          <div className="flex items-center gap-4">
            {ssoEnabled && (
              <button
                onClick={() => {
                  authClient.signIn.sso({
                    callbackURL: `/`,
                  });
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Sign In with SSO
              </button>
            )}
            <OrganizationSwitcher />
          </div>
        </div>
      </div>

      <OrganizationsHome />
    </div>
  );
}
