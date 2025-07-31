import React from "react";
import { Icon } from "../../components/atoms/Icon";

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
  // If there's no next page but there is a previous page, show only the big previous button
  if (!next && previous) {
    return (
      <div className="bg-secondary rounded-xl p-1 w-full">
        <div className="bg-background rounded-lg min-w-0">
          <a
            href={previous.href}
            className="flex items-center justify-start gap-2 px-3 py-4 rounded-lg border border-transparent hover:border-border transition-colors min-w-0"
          >
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg flex-shrink-0">
              <Icon
                name="ChevronLeft"
                size={16}
                className="text-muted-foreground"
              />
              <span className="text-sm text-muted-foreground">Previous</span>
            </div>

            <div className="hidden sm:flex items-center justify-center h-8 w-0 flex-shrink-0">
              <div className="w-8 h-0 border-t border-border rotate-90"></div>
            </div>

            <div className="text-left flex-1 min-w-0">
              <div className="text-sm font-semibold text-card-foreground leading-5 truncate">
                {previous.title}
              </div>
              {previous.description && (
                <div className="text-sm text-muted-foreground leading-5 truncate">
                  {previous.description}
                </div>
              )}
            </div>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-secondary rounded-xl p-1 w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1">
        {/* Previous button */}
        <div className="flex-none">
          {previous ? (
            <a
              href={previous.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:text-foreground transition-colors"
            >
              <Icon
                name="ChevronLeft"
                size={16}
                className="text-muted-foreground hover:text-foreground transition-colors"
              />
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Previous
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-50">
              <Icon
                name="ChevronLeft"
                size={16}
                className="text-muted-foreground"
              />
              <span className="text-sm text-muted-foreground leading-5">
                Previous
              </span>
            </div>
          )}
        </div>

        {/* Next button */}
        <div className="flex-1 bg-background rounded-lg sm:ml-1 min-w-0">
          {next && (
            <a
              href={next.href}
              className="flex items-center justify-end gap-2 px-3 py-4 rounded-lg border border-transparent hover:border-border transition-colors min-w-0"
            >
              <div className="text-right flex-1 min-w-0">
                <div className="text-sm font-semibold text-card-foreground leading-5 truncate">
                  {next.title}
                </div>
                {next.description && (
                  <div className="text-sm text-muted-foreground leading-5 truncate">
                    {next.description}
                  </div>
                )}
              </div>

              <div className="hidden sm:flex items-center justify-center h-8 w-0 flex-shrink-0">
                <div className="w-8 h-0 border-t border-border rotate-90"></div>
              </div>

              <div className="flex items-center gap-3 px-3 py-2 rounded-lg flex-shrink-0">
                <span className="text-sm text-muted-foreground leading-5">
                  Next
                </span>
                <Icon
                  name="ChevronRight"
                  size={16}
                  className="text-muted-foreground opacity-50"
                />
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
