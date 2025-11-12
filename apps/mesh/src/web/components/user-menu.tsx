import { UserMenu } from "@deco/ui/components/user-menu.tsx";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import { authClient } from "@/web/lib/auth-client";

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
      <UserMenu.Item onClick={() => authClient.signOut()}>Logout</UserMenu.Item>
    </UserMenu>
  );
}
