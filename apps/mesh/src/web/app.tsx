import { useState } from "react";
import { authClient } from "./lib/auth-client";
import { Link } from "react-router-dom";
import {
  UserButton,
  AccountSettingsCards,
  AccountView,
  OrganizationSwitcher,
} from "@daveyplate/better-auth-ui";

export default function App() {
  const [count, setCount] = useState(0);
  const { data: session } = authClient.useSession();

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1>Aqui vai o seu Deco CMS Admin self hosted</h1>
      <UserButton />
      <OrganizationSwitcher />
    </div>
  );
}
