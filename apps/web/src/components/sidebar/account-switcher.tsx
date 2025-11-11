import { Icon } from "@deco/ui/components/icon.tsx";
import {
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
} from "@deco/ui/components/responsive-dropdown.tsx";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from "@deco/ui/components/dropdown-menu.tsx";
import { DECO_CMS_API_URL } from "@deco/sdk";
import { useMemo } from "react";
import { useLocation } from "react-router";
import { UserAvatar } from "../common/avatar/user.tsx";
import { useMultiAccount, type StoredAccount } from "../../hooks/use-multi-account";
import { useUser } from "../../hooks/use-user";

function AccountItem({
  account,
  onClick,
}: {
  account: StoredAccount;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem asChild>
      <button
        type="button"
        className="flex items-center gap-3 text-sm w-full cursor-pointer py-2.5"
        onClick={onClick}
      >
        <UserAvatar
          url={account.avatar_url}
          fallback={account.full_name || account.email}
          size="xs"
        />
        <div className="flex flex-col items-start flex-1 min-w-0">
          <span className="font-medium truncate w-full text-left">
            {account.full_name || "Unnamed"}
          </span>
          <span className="text-xs text-muted-foreground truncate w-full text-left">
            {account.email}
          </span>
        </div>
      </button>
    </DropdownMenuItem>
  );
}

export function AccountSwitcher() {
  const currentUser = useUser();
  const location = useLocation();
  const { accounts, switchAccount } = useMultiAccount(currentUser);

  const addAccountUrl = useMemo(() => {
    const logoutUrl = new URL(DECO_CMS_API_URL);
    logoutUrl.pathname = "/auth/logout";

    const loginUrl = new URL(DECO_CMS_API_URL);
    loginUrl.pathname = "/login/oauth";

    const next = new URL(location.pathname, globalThis.location.origin);
    loginUrl.searchParams.set("next", next.href);

    logoutUrl.searchParams.set("next", loginUrl.href);

    return logoutUrl.href;
  }, [location.pathname]);

  // Filter out current user from the list
  const otherAccounts = accounts.filter((acc) => acc.id !== currentUser.id);

  return (
    <>
      <ResponsiveDropdownSeparator />

      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Icon name="swap_horiz" className="text-muted-foreground" />
          Switch account
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-[280px]">
          {otherAccounts.length > 0 ? (
            <>
              {otherAccounts.map((account) => (
                <AccountItem
                  key={account.id}
                  account={account}
                  onClick={() => switchAccount(account)}
                />
              ))}
              <DropdownMenuItem asChild>
                <a
                  href={addAccountUrl}
                  className="flex items-center gap-2 text-sm cursor-pointer border-t mt-1 pt-2"
                >
                  <Icon name="add" size={18} className="text-muted-foreground" />
                  Add account
                </a>
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem asChild>
              <a
                href={addAccountUrl}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Icon name="add" size={18} className="text-muted-foreground" />
                Add account
              </a>
            </DropdownMenuItem>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}

