import { cn } from "@deco/ui/lib/utils.ts";

interface TopbarProps {
  children: React.ReactNode;
}

export function Topbar({ children }: TopbarProps) {
  return (
    <header
      className={cn(
        "w-full h-10 min-h-10",
        "grid grid-cols-2 justify-between justify-items-end gap-4 items-center",
      )}
    >
      {children}
    </header>
  );
}
