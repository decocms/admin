import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useState } from "react";

function useScrollFade() {
  const [showFade, setShowFade] = useState(false);

  const checkScroll = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 2;
    setShowFade(hasOverflow && !isAtBottom);
  }, []);

  const ref = useCallback(
    (el: HTMLDivElement | null) => checkScroll(el),
    [checkScroll],
  );

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => checkScroll(e.currentTarget),
    [checkScroll],
  );

  return { ref, showFade, onScroll };
}

export interface SelectableListItem {
  id: string;
}

export interface SelectableListProps<T extends SelectableListItem> {
  items: T[];
  header?: React.ReactNode;
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
  renderItem: (item: T) => React.ReactNode;
}

export function SelectableList<T extends SelectableListItem>({
  items,
  header,
  emptyMessage = "No items available",
  maxHeight = "200px",
  className,
  renderItem,
}: SelectableListProps<T>) {
  const scroll = useScrollFade();

  return (
    <div className={className}>
      {header}
      <div
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        className="overflow-auto"
        style={{
          maxHeight,
          ...(scroll.showFade
            ? {
                maskImage:
                  "linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)",
              }
            : undefined),
        }}
      >
        {items.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            {emptyMessage}
          </div>
        ) : (
          items.map((item, i) => (
            <div key={item.id} className={cn(i >= 1 && "py-1")}>
              {renderItem(item)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export interface ListHeaderProps {
  label: string;
  count?: number;
  trailing?: React.ReactNode;
}

export function ListHeader({ label, count, trailing }: ListHeaderProps) {
  return (
    <div className="px-3 py-1.5 bg-muted/30 border-b border-border flex items-center justify-between">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
        {count !== undefined && ` (${count})`}
      </span>
      {trailing}
    </div>
  );
}

export interface ListItemRowProps {
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function ListItemRow({
  selected,
  onClick,
  className,
  children,
}: ListItemRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/50",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
