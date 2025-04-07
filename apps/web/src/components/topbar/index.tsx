import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Link } from "react-router";
import { Suspense } from "react";
import { UserMenu as UserMenuInner } from "./user.tsx";
import { NotLoggedInError, useUser } from "../../hooks/data/useUser.ts";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";

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

LoginButton.Skeleton = () => (
  <div className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-4 py-2 gap-2">
    <span className="w-24 h-8"></span>
  </div>
);

function UserMenu() {
  const user = useUser();
  return <UserMenuInner user={user} />;
}

export function Topbar() {
  return (
    <header
      className={cn("w-full h-10 min-h-10", "grid grid-cols-2 items-center")}
    >
      <div />

      <div className="justify-self-end flex items-center">
        <Suspense fallback={<LoginButton.Skeleton />}>
          <ErrorBoundary shouldCatch={(error) => error instanceof NotLoggedInError} fallback={<LoginButton />}>
            <UserMenu />
          </ErrorBoundary>
        </Suspense>
      </div>
    </header>
  );
}
