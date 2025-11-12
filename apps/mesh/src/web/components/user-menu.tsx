import { UserMenu } from "@deco/ui/components/user-menu.tsx";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { authClient } from "@/web/lib/auth-client";
import { GitHubIcon } from "@daveyplate/better-auth-ui";

export function MeshUserMenu() {
  const { data: session } = authClient.useSession();

  // Return skeleton/placeholder if no session yet
  if (!session?.user) {
    return (
      <Avatar
        url={undefined}
        fallback="U"
        shape="circle"
        size="sm"
        className="cursor-pointer"
        muted
      />
    );
  }

  const user = session.user;
  const userImage = (user as { image?: string }).image;

  return (
    <UserMenu
      user={user}
      trigger={() => (
        <Avatar
          url={userImage}
          fallback={user.name || user.email || "U"}
          shape="circle"
          size="sm"
          className="cursor-pointer hover:ring-2 ring-muted-foreground transition-all"
        />
      )}
      align="end"
    >
      <UserMenu.Item asChild>
        <a
          href="https://github.com/decocms/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-2 text-sm cursor-pointer"
        >
          <GitHubIcon className="w-4 h-4 text-muted-foreground" />
          decocms/admin
          <Icon
            name="arrow_outward"
            size={18}
            className="text-muted-foreground ml-auto"
          />
        </a>
      </UserMenu.Item>
      <UserMenu.Item asChild>
        <a
          href="https://decocms.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-2 text-sm cursor-pointer"
        >
          <Icon name="language" className="text-muted-foreground" />
          Homepage
          <Icon
            name="arrow_outward"
            size={18}
            className="ml-auto text-muted-foreground"
          />
        </a>
      </UserMenu.Item>

      <UserMenu.Separator />

      <UserMenu.Item onClick={() => authClient.signOut()}>
        <Icon name="logout" size={18} className="text-muted-foreground" />
        Log out
      </UserMenu.Item>
    </UserMenu>
  );
}
