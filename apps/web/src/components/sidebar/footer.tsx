import { AUTH_URL } from "@deco/sdk";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarFooter as SidebarFooterInner,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@deco/ui/components/sidebar.tsx";
import { Suspense, useMemo } from "react";
import { Link, useLocation } from "react-router";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { NotLoggedInError, useUser } from "../../hooks/data/useUser.ts";
import { Avatar } from "../common/Avatar.tsx";

function LoggedUser() {
  const user = useUser();
  const location = useLocation();

  const logoutUrl = useMemo(() => {
    const url = new URL(AUTH_URL);
    url.pathname = "/auth/logout";

    const next = new URL(location.pathname, globalThis.location.origin);
    url.searchParams.set("next", next.href);

    return url.href;
  }, [location.pathname]);

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="cursor-pointer">
          <Avatar
            url={userAvatarURL}
            fallback={userName}
            className="w-4 h-4"
          />

          <span className="text-xs">{user.metadata?.full_name}</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem asChild>
          <a
            href={logoutUrl}
            className="flex items-center gap-2 leading-7 text-xs"
          >
            <Icon name="logout" size={16} />
            Log out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AnonymouseUser() {
  const to = `/login?next=${globalThis?.location?.href}`;

  return (
    <SidebarMenuButton>
      <Link to={to}>
        <Icon name="person" size={16} />
        Sign in
      </Link>
    </SidebarMenuButton>
  );
}

function Skeleton() {
  return (
    <SidebarMenuButton>
      <div className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-4 py-2 gap-2">
        <span className="w-24 h-8"></span>
      </div>
    </SidebarMenuButton>
  );
}

export function SidebarFooter() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ErrorBoundary
        shouldCatch={(error) => error instanceof NotLoggedInError}
        fallback={<AnonymouseUser />}
      >
        <SidebarFooterInner>
          <SidebarMenu>
            <SidebarMenuItem>
              <LoggedUser />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooterInner>
      </ErrorBoundary>
    </Suspense>
  );
}
