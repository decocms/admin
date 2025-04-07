import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Link } from "react-router";
import { User } from "../../stores/global.tsx";
import { UserMenu } from "./user.tsx";
import { AUTH_URL } from "../../constants.ts";
import { useEffect, useState } from "react";

function LoginButton() {
  const to = `/login?next=${globalThis?.location?.href}`;

  return (
    <Button variant="outline" className="gap-2 h-8" asChild data-sign-in-button>
      <Link to={to}>
        <Icon name="person" size={16} />
        Sign in
      </Link>
    </Button>
  );
}

function useUser() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancel = false;
    const fetchUser = async () => {
      const response = await fetch(`${AUTH_URL}/api/user`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (!cancel) {
          setUser(data);
        }
      }
    };

    fetchUser().catch(console.error);

    return () => {
      cancel = true;
    };
  }, []);

  return user;
}

export function Topbar() {
  const user = useUser();

  return (
    <header
      className={cn("w-full h-10 min-h-10", "grid grid-cols-2 items-center")}
    >
      <div />

      <div className="justify-self-end flex items-center">
        {user ? <UserMenu user={user} /> : <LoginButton />}
      </div>
    </header>
  );
}
