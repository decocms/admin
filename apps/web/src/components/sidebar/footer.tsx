import { useWorkspaceWalletBalance } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import {
  SidebarFooter as SidebarFooterInner,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Suspense } from "react";
import { Link } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/use-user.ts";
import { UserAvatar } from "../common/avatar/user.tsx";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";

function WalletBalance() {
  const walletBalance = useWorkspaceWalletBalance();
  const balance = walletBalance.data?.balance ?? 0;
  const formattedBalance = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(balance);
  const { state } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={`Team Balance: ${formattedBalance}`} className="bg-card hover:bg-card/80 h-auto p-3">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-xs text-muted-foreground">FREE PLAN</span>
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-foreground">Team Balance</span>
            <span className="text-sm text-muted-foreground">{formattedBalance}</span>
          </div>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function LoggedUser() {
  const user = useUser();
  const workspaceLink = useWorkspaceLink();

  if (!user) return null;

  const displayName = user.metadata?.full_name || user.email || "User";

  return (
    <ResponsiveDropdown>
      <ResponsiveDropdownTrigger asChild>
        <SidebarMenuButton tooltip={displayName}>
          <UserAvatar 
            url={user.metadata?.avatar_url} 
            fallback={displayName} 
            size="xs" 
          />
          <span>{displayName}</span>
        </SidebarMenuButton>
      </ResponsiveDropdownTrigger>
      <ResponsiveDropdownContent align="end">
        <ResponsiveDropdownItem asChild>
          <Link
            to={workspaceLink("/settings/profile")}
            onClick={() => trackEvent("sidebar_profile_click")}
          >
            <Icon name="person" size={16} />
            Profile Settings
          </Link>
        </ResponsiveDropdownItem>
        <ResponsiveDropdownItem asChild>
          <Link
            to={workspaceLink("/settings")}
            onClick={() => trackEvent("sidebar_settings_click")}
          >
            <Icon name="settings" size={16} />
            Settings
          </Link>
        </ResponsiveDropdownItem>
        <ResponsiveDropdownSeparator />
        <ResponsiveDropdownItem
          onClick={() => {
            trackEvent("sidebar_logout_click");
            window.location.href = "/logout";
          }}
        >
          <Icon name="logout" size={16} />
          Log Out
        </ResponsiveDropdownItem>
      </ResponsiveDropdownContent>
    </ResponsiveDropdown>
  );
}

export function SidebarFooter() {
  return (
    <SidebarFooterInner className="px-2 py-2">
      <SidebarMenu>
        <Suspense fallback={<div className="h-12" />}>
          <WalletBalance />
        </Suspense>
        <SidebarMenuItem>
          <Suspense fallback={<div className="h-12" />}>
            <LoggedUser />
          </Suspense>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooterInner>
  );
}