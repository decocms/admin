import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Tabs, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { FilterBar, type Filter } from "./filter-bar.tsx";

export interface TabItem {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
}

interface ResourceHeaderProps {
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  searchOpen?: boolean;
  searchValue?: string;
  onSearchToggle?: () => void;
  onSearchChange?: (value: string) => void;
  onSearchBlur?: () => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFilterClick?: () => void;
  onRefresh?: () => void;
  ctaButton?: ReactNode;
  viewMode?: "table" | "cards";
  onViewModeChange?: (mode: "table" | "cards") => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc" | null;
  onSort?: (key: string) => void;
  filterBarVisible?: boolean;
  filters?: Filter[];
  onFiltersChange?: (filters: Filter[]) => void;
  availableUsers?: Array<{ id: string; name: string }>;
  hideActions?: boolean;
}

export function ResourceHeader({
  tabs,
  activeTab,
  onTabChange,
  searchOpen,
  searchValue,
  onSearchToggle,
  onSearchChange,
  onSearchBlur,
  onSearchKeyDown,
  onFilterClick,
  onRefresh,
  ctaButton,
  viewMode = "table",
  onViewModeChange,
  sortKey,
  sortDirection,
  onSort,
  filterBarVisible = false,
  filters = [],
  onFiltersChange,
  availableUsers = [],
  hideActions = false,
}: ResourceHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  return (
    <div className="flex flex-col gap-3 w-full px-8 py-4">
      {/* Tabs and Actions Row */}
      <div className="flex items-center justify-between border-b border-border w-full min-w-0">
        {/* Left: Tabs (if provided) */}
        {tabs && tabs.length > 0 ? (
          <Tabs
            value={activeTab}
            onValueChange={(tabId) => {
              // Prefer onTabChange if provided, otherwise use tab.onClick
              if (onTabChange) {
                onTabChange(tabId);
              } else {
                const tab = tabs.find((t) => t.id === tabId);
                tab?.onClick?.();
              }
            }}
            variant="underline"
          >
            <TabsList variant="underline" className="border-0 flex-nowrap">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} variant="underline">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right: Action Buttons */}
        {!hideActions && (
          <div className="flex items-center justify-end gap-2 py-2 shrink-0">
            {/* Refresh Button */}
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                className="h-9 w-9 flex items-center text-muted-foreground justify-center"
              >
                <Icon name="refresh" size={20} />
              </Button>
            )}

            {/* Search Button / Input */}
            {onSearchToggle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSearchToggle}
                className="h-9 w-9 flex items-center text-muted-foreground justify-center"
              >
                <Icon name="search" size={20} />
              </Button>
            )}
            {searchOpen && (
              <Input
                ref={searchInputRef}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onBlur={onSearchBlur}
                onKeyDown={onSearchKeyDown}
                placeholder="Search..."
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-9 w-32 md:w-auto"
              />
            )}

            {/* Filter Button */}
            {onFilterClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onFilterClick}
                className="h-9 w-9 flex items-center justify-center"
              >
                <Icon
                  name="filter_list"
                  size={20}
                  className={
                    filters && filters.length > 0
                      ? "text-violet-500"
                      : "text-muted-foreground"
                  }
                />
              </Button>
            )}

            {/* Menu Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex items-center text-muted-foreground justify-center"
                >
                  <Icon name="more_horiz" size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1">
                {/* View Mode Toggle */}
                <div className="flex items-center p-1">
                  <div className="flex gap-1 w-full">
                    <Button
                      variant={viewMode === "cards" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => onViewModeChange?.("cards")}
                      className="flex-1 h-10 "
                    >
                      <Icon
                        name="grid_view"
                        size={20}
                        className="text-muted-foreground"
                      />
                    </Button>
                    <Button
                      variant={viewMode === "table" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => onViewModeChange?.("table")}
                      className="flex-1 h-10"
                    >
                      <Icon
                        name="view_list"
                        size={20}
                        className="text-muted-foreground"
                      />
                    </Button>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-1" />

                {/* Sort By Section */}
                <div className="p-2">
                  <p className="text-xs text-muted-foreground uppercase font-mono">
                    Sort by
                  </p>
                </div>

                <DropdownMenuItem
                  onClick={() => onSort?.("title")}
                  className="cursor-pointer"
                >
                  {sortKey === "title" && (
                    <Icon
                      name="check"
                      size={16}
                      className="mr-2 text-foreground"
                    />
                  )}
                  {sortKey !== "title" && <span className="w-4 mr-2" />}
                  <span className="flex-1">Name</span>
                  {sortKey === "title" && sortDirection && (
                    <Icon
                      name={
                        sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                      }
                      size={16}
                      className="ml-2 text-muted-foreground"
                    />
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onSort?.("description")}
                  className="cursor-pointer"
                >
                  {sortKey === "description" && (
                    <Icon
                      name="check"
                      size={16}
                      className="mr-2 text-foreground"
                    />
                  )}
                  {sortKey !== "description" && <span className="w-4 mr-2" />}
                  <span className="flex-1">Description</span>
                  {sortKey === "description" && sortDirection && (
                    <Icon
                      name={
                        sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                      }
                      size={16}
                      className="ml-2 text-muted-foreground"
                    />
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onSort?.("updated_at")}
                  className="cursor-pointer"
                >
                  {sortKey === "updated_at" && (
                    <Icon
                      name="check"
                      size={16}
                      className="mr-2 text-foreground"
                    />
                  )}
                  {sortKey !== "updated_at" && <span className="w-4 mr-2" />}
                  <span className="flex-1">Date updated</span>
                  {sortKey === "updated_at" && sortDirection && (
                    <Icon
                      name={
                        sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                      }
                      size={16}
                      className="ml-2 text-muted-foreground"
                    />
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onSort?.("updated_by")}
                  className="cursor-pointer"
                >
                  {sortKey === "updated_by" && (
                    <Icon
                      name="check"
                      size={16}
                      className="mr-2 text-foreground"
                    />
                  )}
                  {sortKey !== "updated_by" && <span className="w-4 mr-2" />}
                  <span className="flex-1">Updated by</span>
                  {sortKey === "updated_by" && sortDirection && (
                    <Icon
                      name={
                        sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                      }
                      size={16}
                      className="ml-2 text-muted-foreground"
                    />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* CTA Button - comes last */}
            {ctaButton && <div className="hidden md:block">{ctaButton}</div>}
          </div>
        )}
      </div>

      {/* Mobile CTA Button */}
      {ctaButton && <div className="md:hidden w-full">{ctaButton}</div>}

      {/* Filter Bar */}
      {filterBarVisible && onFiltersChange && (
        <FilterBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          availableUsers={availableUsers}
        />
      )}
    </div>
  );
}
