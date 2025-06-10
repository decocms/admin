import type { Prompt } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import { useEffect, useState } from "react";

interface Props {
  items: Prompt[];
  command: (props: MentionNodeAttrs) => void;
}

export const MentionDropdown = ({ items, command }: Props) => {
  const [selected, setSelected] = useState(0);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      command({ id: item.id, label: item.name });
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    console.log(event.key);
    if (event.key === "ArrowDown") {
      setSelected((prev) => (prev + 1) % items.length);
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setSelected((prev) => (prev - 1 + items.length) % items.length);
      event.preventDefault();
    } else if (event.key === "Enter") {
      selectItem(selected);
      event.preventDefault();
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected, items]);

  return (
    <div className="rounded-2xl p-1 flex flex-col gap-1 bg-white shadow-lg border text-sm font-medium max-w-56">
      {items.map((item, index) => (
        <Button
          key={item.id}
          variant={selected === index ? "special" : "ghost"}
          onMouseEnter={() => setSelected(index)}
          onClick={() => selectItem(index)}
          className="w-full line-clamp-1 text-left"
        >
          @{item.name}
        </Button>
      ))}
    </div>
  );
};
