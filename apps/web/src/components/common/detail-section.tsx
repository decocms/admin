import type { ReactNode } from "react";

export interface DetailSectionProps {
  /** Optional section title */
  title?: string;
  /** Title size variant */
  titleSize?: "h1" | "h2";
  /** Content to render in the section */
  children: ReactNode;
  /** Optional additional className for the outer container */
  className?: string;
  /** Optional additional className for the inner content container */
  contentClassName?: string;
}

/**
 * Reusable section component for detail pages (workflow runs, tools, workflows, etc.)
 * Provides consistent padding, borders, and max-width constraints
 */
export function DetailSection({
  title,
  titleSize = "h2",
  children,
  className = "",
  contentClassName = "",
}: DetailSectionProps) {
  return (
    <div
      className={`px-4 lg:px-6 xl:px-10 py-4 md:py-6 lg:py-8 z-10 bg-background border-b border-border ${className}`}
    >
      <div className={`max-w-[1500px] mx-auto space-y-4 ${contentClassName}`}>
        {title && (
          <>
            {titleSize === "h1" ? (
              <h1 className="text-2xl font-medium">{title}</h1>
            ) : (
              <h2 className="text-lg font-medium">{title}</h2>
            )}
          </>
        )}
        {children}
      </div>
    </div>
  );
}
