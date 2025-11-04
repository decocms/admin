import { OrganizationSwitcher } from "@daveyplate/better-auth-ui";
import { authClient } from "../lib/auth-client";
import { OrganizationsHome } from "../components/organizations-home";

export default function App() {
  const session = authClient.useSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Decocms Mesh</h1>
          <div className="flex items-center gap-4">
            <OrganizationSwitcher />
          </div>
        </div>
      </div>

      <OrganizationsHome />
    </div>
  );
}
