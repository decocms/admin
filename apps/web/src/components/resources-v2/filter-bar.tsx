import { Button } from "@deco/ui/components/button.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@deco/ui/components/command.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useState } from "react";
import { UserInfo } from "../common/table/table-cells.tsx";

export type FilterOperator =
  | "contains"
  | "does_not_contain"
  | "is"
  | "is_not"
  | "in_last"
  | "before"
  | "after"
  | "between";

export type FilterColumn =
  | "name"
  | "description"
  | "created_at"
  | "updated_at"
  | "created_by"
  | "updated_by";

export interface Filter {
  id: string;
  column: FilterColumn;
  operator: FilterOperator;
  value: any;
}

interface FilterBarProps {
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
  availableUsers?: Array<{ id: string; name: string }>;
}

const COLUMN_LABELS: Record<FilterColumn, string> = {
  name: "Name",
  description: "Description",
  created_at: "Date created",
  updated_at: "Date updated",
  created_by: "Created by",
  updated_by: "Updated by",
};

const TEXT_OPERATORS: Record<string, string> = {
  contains: "contains",
  does_not_contain: "does not contain",
  is: "is",
  is_not: "is not",
};

const USER_OPERATORS: Record<string, string> = {
  is: "is",
};

const DATE_PRESETS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 3 months", value: "3m" },
  { label: "All time", value: "all" },
];

function getOperatorsForColumn(column: FilterColumn): Record<string, string> {
  if (column === "name" || column === "description") {
    return TEXT_OPERATORS;
  }
  if (column === "created_by" || column === "updated_by") {
    return USER_OPERATORS;
  }
  return { in_last: "in last" };
}

function getDefaultOperatorForAutoStep(column: FilterColumn): FilterOperator | null {
  // Only set default operator for columns that skip the operator step
  if (column === "created_by" || column === "updated_by") {
    return "is";
  }
  if (column === "created_at" || column === "updated_at") {
    return "in_last";
  }
  // For text columns, we want to show the operator selection step
  return null;
}

function getDefaultValue(column: FilterColumn): any {
  if (column === "created_at" || column === "updated_at") {
    return "7d";
  }
  return "";
}

export function FilterBar({
  filters,
  onFiltersChange,
  availableUsers = [],
}: FilterBarProps) {
  const [addingFilter, setAddingFilter] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<FilterColumn | null>(
    null,
  );
  const [selectedOperator, setSelectedOperator] =
    useState<FilterOperator | null>(null);
  const [filterValue, setFilterValue] = useState<any>("");
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);

  function addFilter(column: FilterColumn, operator: FilterOperator, value: any) {
    if (editingFilterId) {
      // Update existing filter
      onFiltersChange(
        filters.map((f) =>
          f.id === editingFilterId
            ? { id: f.id, column, operator, value }
            : f,
        ),
      );
    } else {
      // Add new filter
      const newFilter: Filter = {
        id: crypto.randomUUID(),
        column,
        operator,
        value,
      };
      onFiltersChange([...filters, newFilter]);
    }
    resetAddFilter();
  }

  function removeFilter(filterId: string) {
    onFiltersChange(filters.filter((f) => f.id !== filterId));
  }

  function resetAddFilter() {
    setAddingFilter(false);
    setSelectedColumn(null);
    setSelectedOperator(null);
    setFilterValue("");
    setEditingFilterId(null);
  }

  function getFilterLabel(filter: Filter): string {
    const columnLabel = COLUMN_LABELS[filter.column];

    // For text columns, show operator
    if (filter.column === "name" || filter.column === "description") {
      const operators = getOperatorsForColumn(filter.column);
      const operatorLabel = operators[filter.operator] || filter.operator;
      return `${columnLabel} ${operatorLabel} "${filter.value}"`;
    }

    // For date columns, show preset label without operator
    if (filter.column === "created_at" || filter.column === "updated_at") {
      const preset = DATE_PRESETS.find((p) => p.value === filter.value);
      const valueLabel = preset ? preset.label : filter.value;
      return `${columnLabel}: ${valueLabel}`;
    }

    // For user columns, just show column label (value shown via UserInfo component)
    return columnLabel;
  }

  function renderDropdownContent() {
    if (!selectedColumn) {
      // Step 1: Select Column
      return (
        <>
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground uppercase font-mono">
              Select to filter
            </p>
          </div>
          {Object.entries(COLUMN_LABELS).map(([key, label]) => (
            <DropdownMenuItem
              key={key}
              onSelect={(e) => {
                e.preventDefault();
                const col = key as FilterColumn;
                setSelectedColumn(col);
                // For user/date columns, set operator automatically to skip step 2
                // For text columns, keep operator null to show step 2
                setSelectedOperator(getDefaultOperatorForAutoStep(col));
                setFilterValue(getDefaultValue(col));
              }}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </>
      );
    }

    if (!selectedOperator) {
      // Step 2: Select Operator
      return (
        <>
          <div className="px-2 py-1.5 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setSelectedColumn(null);
                setSelectedOperator(null);
              }}
            >
              <Icon name="arrow_back" size={16} />
            </Button>
            <p className="text-xs text-muted-foreground uppercase font-mono">
              {COLUMN_LABELS[selectedColumn]}
            </p>
          </div>
          <DropdownMenuSeparator />
          {Object.entries(getOperatorsForColumn(selectedColumn)).map(
            ([key, label]) => (
              <DropdownMenuItem
                key={key}
                onSelect={(e) => {
                  e.preventDefault();
                  setSelectedOperator(key as FilterOperator);
                }}
              >
                {label}
              </DropdownMenuItem>
            ),
          )}
        </>
      );
    }

    // Step 3: Select Value
    return (
      <>
        <div className="px-2 py-1.5 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              // For text columns, go back to operator selection
              // For user/date columns, go back to column selection
              if (selectedColumn === "name" || selectedColumn === "description") {
                setSelectedOperator(null);
              } else {
                setSelectedColumn(null);
                setSelectedOperator(null);
              }
            }}
          >
            <Icon name="arrow_back" size={16} />
          </Button>
          <p className="text-xs text-muted-foreground uppercase font-mono">
            {selectedColumn === "name" || selectedColumn === "description" 
              ? `${COLUMN_LABELS[selectedColumn]} ${getOperatorsForColumn(selectedColumn)[selectedOperator]}`
              : COLUMN_LABELS[selectedColumn]
            }
          </p>
        </div>
        <DropdownMenuSeparator />

        {/* Text Input */}
        {(selectedColumn === "name" || selectedColumn === "description") && (
          <div className="p-2">
            <Input
              autoFocus
              placeholder="Enter value..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filterValue) {
                  addFilter(selectedColumn, selectedOperator, filterValue);
                }
              }}
              className="h-8"
            />
            <Button
              size="sm"
              className="w-full mt-2"
              onClick={() => {
                if (filterValue) {
                  addFilter(selectedColumn, selectedOperator, filterValue);
                }
              }}
              disabled={!filterValue}
            >
              Apply
            </Button>
          </div>
        )}

        {/* User Selector */}
        {(selectedColumn === "created_by" ||
          selectedColumn === "updated_by") && (
          <Command className="border-0">
            <CommandInput placeholder="Search users..." className="h-9" />
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup>
                {availableUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => {
                      addFilter(selectedColumn, selectedOperator, user.id);
                    }}
                  >
                    <UserInfo userId={user.id} showEmail={false} noTooltip size="sm" />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}

        {/* Date Presets */}
        {(selectedColumn === "created_at" ||
          selectedColumn === "updated_at") && (
          <>
            {DATE_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.value}
                onSelect={(e) => {
                  e.preventDefault();
                  addFilter(selectedColumn, selectedOperator, preset.value);
                }}
              >
                {preset.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Active Filters */}
      {filters.map((filter) => (
        <DropdownMenu
          key={filter.id}
          open={addingFilter && editingFilterId === filter.id}
          onOpenChange={(open) => {
            if (!open && editingFilterId === filter.id) {
              resetAddFilter();
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <div
              className="group flex items-center gap-1 px-3 h-8 bg-accent rounded-lg text-sm cursor-pointer hover:bg-accent/80 transition-colors"
              onClick={() => {
                // Set up the filter for editing (don't remove it)
                setEditingFilterId(filter.id);
                setSelectedColumn(filter.column);
                
                // For text columns, show operator selection
                if (filter.column === "name" || filter.column === "description") {
                  setSelectedOperator(filter.operator);
                } else {
                  // For user/date columns, set operator to skip that step
                  setSelectedOperator(getDefaultOperatorForAutoStep(filter.column));
                }
                
                setFilterValue(filter.value);
                setAddingFilter(true);
              }}
            >
              {(filter.column === "created_by" || filter.column === "updated_by") &&
              filter.value ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {COLUMN_LABELS[filter.column]}:
                  </span>
                  <UserInfo userId={filter.value} showEmail={false} noTooltip size="sm" />
                </div>
              ) : (
                <span className="text-foreground">{getFilterLabel(filter)}</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFilter(filter.id);
                }}
                className="flex items-center justify-center w-0 opacity-0 group-hover:w-4 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all overflow-hidden"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </DropdownMenuTrigger>
          {addingFilter && editingFilterId === filter.id && (
            <DropdownMenuContent align="start" className="w-64">
              {renderDropdownContent()}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      ))}

      {/* Add Filter Dropdown */}
      <DropdownMenu 
        open={addingFilter && !editingFilterId} 
        onOpenChange={(open) => {
          if (!open) {
            resetAddFilter();
          } else {
            setAddingFilter(open);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Icon name="add" size={16} />
            Add filter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {renderDropdownContent()}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

