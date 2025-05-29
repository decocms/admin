import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import type { ReactNode } from "react";

export interface TableColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: (row: T) => ReactNode;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  cellClassName?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns,
  data,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
}: TableProps<T>) {
  function renderSortIcon(key: string) {
    if (!sortKey || sortKey !== key) {
      return (
        <Icon
          name="arrow_upward"
          size={16}
          className="text-muted-foreground/50"
        />
      );
    }
    return (
      <Icon
        name={sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
        size={16}
        className="text-muted-foreground"
      />
    );
  }

  function getHeaderClass(idx: number, total: number) {
    let base =
      "px-4 text-left bg-[#F8FAFC] font-semibold text-[#374151] text-sm h-10";
    if (idx === 0) base += " rounded-l-md";
    if (idx === total - 1) base += " rounded-r-md w-8";
    return base;
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full">
      <UITable className="w-full min-w-max">
        <TableHeader className="sticky top-0 z-10 bg-[#F8FAFC] border-b-0 [&>*:first-child]:border-b-0">
          <TableRow className="hover:bg-transparent h-14">
            {columns.map((col, idx) => (
              <TableHead
                key={col.id}
                className={getHeaderClass(idx, columns.length) +
                  " sticky top-0 z-10 bg-[#F8FAFC]"}
                style={{ cursor: col.sortable ? "pointer" : undefined }}
                onClick={col.sortable && onSort
                  ? () => onSort(col.id)
                  : undefined}
              >
                <span className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && renderSortIcon(col.id)}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow
              key={i}
              className={onRowClick ? "cursor-pointer hover:bg-slate-50" : ""}
              onClick={onRowClick
                ? () => onRowClick(row)
                : undefined}
            >
              {columns.map((col, idx) => (
                <TableCell
                  key={col.id}
                  className={(idx === 0 ? "px-4 " : "") +
                    (col.cellClassName ? col.cellClassName + " " : "") +
                    "truncate overflow-hidden whitespace-nowrap"}
                >
                  {col.render
                    ? col.render(row)
                    : col.accessor
                    ? col.accessor(row)
                    : null}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </UITable>
    </div>
  );
}
