import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import { type Ref, useImperativeHandle, useMemo, useState } from "react";

interface Option {
  id: string;
  label: string;
}

interface Category {
  name: string;
  options: Option[];
}

interface Props {
  items: Category[];
  command: (props: MentionNodeAttrs) => void;
  ref: Ref<unknown>;
}

export default function MentionDropdown({
  items: categories,
  command,
  ref,
}: Props) {
  const [selectedIndex, setSelected] = useState(0);

  const items = useMemo(() => {
    return categories.flatMap((category) =>
      category.options.map((item) => ({
        ...item,
        category: category.name,
      }))
    );
  }, [categories]);

  const isSelected = (item: Option) => {
    return items[selectedIndex].id === item.id;
  };

  const selectItem = (item: Option) => {
    command({ id: item.id, label: item.label });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelected((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }

      if (event.key === "ArrowDown") {
        setSelected((prev) => (prev + 1) % items.length);
        return true;
      }

      if (event.key === "Enter") {
        selectItem(items[selectedIndex]);
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="rounded-xl p-1 flex flex-col gap-1 bg-white shadow-md border text-sm font-medium min-w-56 max-w-64 p-2">
      {categories.map((category) => (
        <div key={category.name} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Icon name="library_books" size={12} />
            {category.name}
          </span>
          <div className="h-px bg-border" />
          {category.options.map((item) => (
            <Button
              key={item.id}
              onClick={() => selectItem(item)}
              variant="ghost"
              size="sm"
              className={cn(
                "w-full line-clamp-1 text-left",
                isSelected(item) ? "bg-accent" : "hover:bg-accent",
              )}
            >
              <span>{item.label}</span>
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
