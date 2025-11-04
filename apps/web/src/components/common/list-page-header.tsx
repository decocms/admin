import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { ComponentProps, InputHTMLAttributes, ReactNode } from "react";
import { ViewModeSwitcher } from "./view-mode-switcher.tsx";

interface Props<TChiplet extends Chiplet> {
  filter?: {
    items: TChiplet[];
    onClick: (item: TChiplet) => void;
  };
  input?: InputHTMLAttributes<HTMLInputElement>;
  view?: ComponentProps<typeof ViewModeSwitcher>;
  actionsLeft?: ReactNode;
  actionsRight?: ReactNode;
  controlsAlign?: "start" | "end";
}

interface Chiplet {
  id: string;
  active?: boolean;
  label: string | ReactNode;
  count: number;
  disabled?: boolean;
  tooltip?: string;
}

interface ChipletProps {
  item: Chiplet;
  onClick: (item: Chiplet) => void;
}

export function Chiplet(props: ChipletProps) {
  const { item, onClick } = props;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          disabled={item.disabled}
          className={cn(
            "shadow-none items-center gap-2",
            item.active && "bg-accent",
          )}
          onClick={() => onClick(item)}
          type="button"
        >
          {item.label}
          <span className="text-xs text-muted-foreground">{item.count}</span>
        </Button>
      </TooltipTrigger>
      {item.tooltip && (
        <TooltipContent side="bottom">{item.tooltip}</TooltipContent>
      )}
    </Tooltip>
  );
}

export function ListPageHeader<TChiplet extends Chiplet>({
  filter,
  input,
  view,
  actionsLeft,
  actionsRight,
  controlsAlign = "end",
}: Props<TChiplet>) {
  const filterItems = filter?.items ?? [];
  const hasLeftContent = filterItems.length > 0 || actionsLeft;
  const controlsAlignmentClass =
    controlsAlign === "start"
      ? "justify-self-start md:justify-self-start"
      : "justify-self-end md:justify-self-end";

  return (
    <div
      className={cn(
        "w-full flex justify-between gap-2",
        hasLeftContent ? "md:grid-cols-[minmax(0,1fr)_auto]" : "md:grid-cols-1",
      )}
    >
      <div className="flex items-center gap-2">
        {input && (
          <Input
            className="w-full sm:w-56 md:w-72 lg:w-80 text-sm min-w-0 shrink"
            {...input}
          />
        )}
      </div>
      {hasLeftContent && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0">
          {filter &&
            filterItems.map((chiplet) => (
              <Chiplet
                key={chiplet.id}
                item={chiplet}
                onClick={filter.onClick as (item: Chiplet) => void}
              />
            ))}
          {actionsLeft}
        </div>
      )}
      <div
        className={cn(
          "flex items-center gap-2 justify-self-auto p-1 min-w-0 shrink-0",
          controlsAlignmentClass,
        )}
      >
        {view && <ViewModeSwitcher {...view} />}
        {actionsRight}
      </div>
    </div>
  );
}
