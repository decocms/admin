import { Button } from "./button.tsx";
import { Icon } from "./icon.tsx";
import { useSidebar } from "./sidebar.tsx";

export function SidebarToggleButton() {
  const { toggleSidebar } = useSidebar();

  return (
    <>
      <Button
        onClick={toggleSidebar}
        size="icon"
        variant="ghost"
        className="w-8 h-8 rounded-md"
      >
        <Icon
          name="dock_to_right"
          className="text-muted-foreground"
          size={20}
        />
      </Button>
      <div className="h-8 w-px bg-border" />
    </>
  );
}

// Skeleton for the toggle button
SidebarToggleButton.Skeleton = function SidebarToggleButtonSkeleton() {
  return (
    <>
      <div className="w-8 h-8 bg-muted rounded-md animate-pulse" />
      <div className="h-8 w-px bg-border" />
    </>
  );
};
