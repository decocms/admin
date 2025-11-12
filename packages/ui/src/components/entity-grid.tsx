import { cn } from "../lib/utils.ts";
import type { ReactNode } from "react";

interface ColumnConfig {
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  "2xl"?: number;
}

interface EntityGridProps {
  children: ReactNode;
  columns?: ColumnConfig;
  gap?: number;
  className?: string;
}

function EntityGridRoot({
  children,
  columns = { sm: 2, md: 3, lg: 4 },
  gap = 4,
  className,
}: EntityGridProps) {
  const gridClasses = cn(
    "w-full grid",
    `gap-${gap}`,
    columns.sm && `grid-cols-${columns.sm}`,
    columns.md && `@min-3xl:grid-cols-${columns.md}`,
    columns.lg && `@min-6xl:grid-cols-${columns.lg}`,
    columns.xl && `@min-7xl:grid-cols-${columns.xl}`,
    columns["2xl"] && `@min-8xl:grid-cols-${columns["2xl"]}`,
    className,
  );

  return <div className={gridClasses}>{children}</div>;
}

function EntityGridSkeleton({
  count = 8,
  columns = { sm: 2, md: 3, lg: 4 },
  gap = 4,
  className,
}: Omit<EntityGridProps, "children"> & { count?: number }) {
  return (
    <EntityGridRoot columns={columns} gap={gap} className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-card hover:bg-accent transition-colors flex flex-col rounded-lg animate-pulse"
        >
          <div className="p-4 flex flex-col gap-4">
            <div className="h-12 w-12 bg-muted rounded-lg" />
            <div className="h-4 w-32 bg-muted rounded-lg" />
            <div className="h-4 w-32 bg-muted rounded-lg" />
          </div>
          <div className="p-4 border-t border-border flex items-center">
            <div className="h-6 w-6 bg-muted rounded-full animate-pulse" />
            <div className="h-6 w-6 bg-muted rounded-full animate-pulse -ml-2" />
            <div className="h-6 w-6 bg-muted rounded-full animate-pulse -ml-2" />
          </div>
        </div>
      ))}
    </EntityGridRoot>
  );
}

export const EntityGrid = Object.assign(EntityGridRoot, {
  Skeleton: EntityGridSkeleton,
});
