import React from "react";
import { Icon } from "./Icon";

export interface NavigationLink {
  title: string;
  description?: string;
  href: string;
}

export interface NavigationProps {
  previous?: NavigationLink;
  next?: NavigationLink;
}

export function Navigation({ previous, next }: NavigationProps) {
  return (
    <div className="bg-muted rounded-xl p-1 w-full">
      <div className="flex items-center">
        {/* Previous button */}
        <div className="flex-none">
          {previous
            ? (
              <a
                href={previous.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card transition-colors"
              >
                <Icon
                  name="ChevronLeft"
                  size={16}
                  className="text-muted-foreground opacity-50"
                />
                <span className="text-sm text-muted-foreground leading-5">
                  Previous
                </span>
              </a>
            )
            : (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-50">
                <Icon name="ChevronLeft" size={16} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground leading-5">
                  Previous
                </span>
              </div>
            )}
        </div>

        {/* Next button */}
        <div className="flex-1 bg-card rounded-lg ml-1">
          {next
            ? (
              <a
                href={next.href}
                className="flex items-center justify-end gap-2 px-3 py-4 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="text-right">
                  <div className="text-sm font-semibold text-muted-foreground leading-5">
                    {next.title}
                  </div>
                  {next.description && (
                    <div className="text-sm text-muted-foreground leading-5">
                      {next.description}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center h-8 w-0">
                  <div className="w-8 h-0 border-t border-border rotate-90">
                  </div>
                </div>

                <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
                  <span className="text-sm text-muted-foreground leading-5">Next</span>
                  <Icon
                    name="ChevronRight"
                    size={16}
                    className="text-muted-foreground opacity-50"
                  />
                </div>
              </a>
            )
            : (
              <div className="flex items-center justify-end gap-2 px-3 py-4 rounded-lg">
                <div className="text-right">
                  <div className="text-sm font-semibold text-muted-foreground leading-5 opacity-50">
                    No next page
                  </div>
                </div>

                <div className="flex items-center justify-center h-8 w-0">
                  <div className="w-8 h-0 border-t border-border rotate-90">
                  </div>
                </div>

                <div className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-50">
                  <span className="text-sm text-muted-foreground leading-5">Next</span>
                  <Icon
                    name="ChevronRight"
                    size={16}
                    className="text-muted-foreground"
                  />
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
