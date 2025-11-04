import { authClient } from "../lib/auth-client";
import { OrganizationsHome } from "../components/organizations-home";

export default function App() {
  const session = authClient.useSession();

  return (
    <div className="min-h-full">
      <OrganizationsHome />
    </div>
  );
}
