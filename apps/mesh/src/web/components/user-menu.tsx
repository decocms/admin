import { UserMenu } from "@deco/ui/components/user-menu.tsx";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { authClient } from "@/web/lib/auth-client";
import { GitHubIcon } from "@daveyplate/better-auth-ui";
import { useState } from "react";

function ProfileDialog({
  open,
  onOpenChange,
  user,
  userImage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; name?: string | null; email: string };
  userImage?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Your account information</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-4">
          <Avatar
            url={userImage}
            fallback={user.name || user.email || "U"}
            shape="circle"
            size="2xl"
          />
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="text-lg font-semibold text-center">
              {user.name || user.email}
            </div>
            <div className="text-sm text-muted-foreground text-center">
              {user.email}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                User ID
              </span>
              <span className="text-sm font-mono truncate">{user.id}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyUserId}
              className="flex-shrink-0 p-2 hover:bg-background rounded-md transition-colors"
              aria-label="Copy user ID"
            >
              <Icon
                name={copied ? "check" : "content_copy"}
                size={16}
                className={copied ? "text-green-600" : "text-muted-foreground"}
              />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MeshUserMenu() {
  const { data: session } = authClient.useSession();
  const [profileOpen, setProfileOpen] = useState(false);

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
    <>
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
        <UserMenu.Item onClick={() => setProfileOpen(true)}>
          <Icon name="account_circle" className="text-muted-foreground" />
          Profile
        </UserMenu.Item>

        <UserMenu.Separator />

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

      {profileOpen && (
        <ProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          user={user}
          userImage={userImage}
        />
      )}
    </>
  );
}
