import { useWorkspaceWalletBalance, usePlan } from "@deco/sdk";
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
import { Suspense, useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/use-user.ts";
import { UserAvatar } from "../common/avatar/user.tsx";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";

// Custom hook for animating number changes
function useAnimatedNumber(targetValue: number, duration: number = 1000) {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValueRef = useRef<number>(targetValue);

  useEffect(() => {
    if (targetValue === displayValue) return;

    setIsAnimating(true);
    startValueRef.current = displayValue;
    startTimeRef.current = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - (startTimeRef.current || now);
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValueRef.current + (targetValue - startValueRef.current) * easeOutCubic;
      setDisplayValue(Math.round(currentValue)); // Round to whole numbers for cleaner animation
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, displayValue]);

  return { displayValue, isAnimating };
}

function WalletBalance() {
  const { balance } = useWorkspaceWalletBalance();
  const plan = usePlan();
  const { state } = useSidebar();
  const [flashAnimation, setFlashAnimation] = useState(false);
  
  // Use animated number for smooth counting
  const numericBalance = typeof balance === 'number' ? balance : 0;
  const { displayValue: animatedBalance, isAnimating: isCountingUp } = useAnimatedNumber(numericBalance, 800);
  const formattedBalance = `$${animatedBalance.toLocaleString()}`;
  
  // Debug logging
  useEffect(() => {
    console.log('[SIDEBAR] Balance changed:', balance, 'Numeric:', numericBalance);
  }, [balance, numericBalance]);

  // Listen for wallet bonus claimed event
  useEffect(() => {
    const handleBonusClaimed = (event: CustomEvent) => {
      console.log('[SIDEBAR] Bonus claimed event received, starting flash animation');
      setFlashAnimation(true);
      setTimeout(() => {
        console.log('[SIDEBAR] Flash animation timeout, setting to false');
        setFlashAnimation(false);
      }, 1200);
    };

    window.addEventListener('wallet-bonus-claimed', handleBonusClaimed as EventListener);
    return () => {
      window.removeEventListener('wallet-bonus-claimed', handleBonusClaimed as EventListener);
    };
  }, []);

  // Debug logging for animation state
  useEffect(() => {
    console.log('[SIDEBAR] Animation state - flashAnimation:', flashAnimation, 'isCountingUp:', isCountingUp);
  }, [flashAnimation, isCountingUp]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton 
        tooltip={`Team Balance: ${formattedBalance}`} 
        className={cn(
          "bg-sidebar-accent hover:bg-sidebar-accent/80 h-auto p-3 transition-all duration-500 ease-out",
          flashAnimation && "ring-2 ring-primary/50 bg-primary/10 scale-[1.02]"
        )}
      >
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-xs text-muted-foreground">{plan.title.toUpperCase()}</span>
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-foreground">Team Balance</span>
            <span 
              className={cn(
                "text-sm text-muted-foreground transition-all duration-500 ease-out font-normal",
                (flashAnimation || isCountingUp) && "text-primary font-semibold scale-110"
              )}
            >
              {formattedBalance}
            </span>
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