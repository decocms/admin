import { cn } from "@deco/ui/lib/utils.ts";

// Grid components to match marketplace dialog layout
export function GridRightColumn({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-right-column
      className="col-span-6 py-4 max-h-133 pl-2 overflow-y-scroll"
    >
      {children}
    </div>
  );
}

export function GridLeftColumn({ children }: { children: React.ReactNode }) {
  return (
    <div data-left-column className="flex flex-col col-span-4">
      <img
        src="/img/oauth-modal-banner.png?v=0"
        alt="OAuth Modal Banner"
        className="w-full object-cover"
      />
      {children}
    </div>
  );
}

export function GridContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-grid-container
      className={cn("grid grid-cols-10 gap-6 divide-x", className)}
    >
      {children}
    </div>
  );
}
