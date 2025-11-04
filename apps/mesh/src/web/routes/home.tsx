import { authClient } from "../lib/auth-client";
import { OrganizationsHome } from "../components/organizations-home";

export default function App() {
  return (
    <div className="min-h-full">
      <OrganizationsHome />
    </div>
  );
}
