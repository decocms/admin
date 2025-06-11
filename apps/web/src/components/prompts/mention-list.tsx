import { Prompt } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

interface MentionListProps {
  items: Prompt[];
  command: (item: Prompt) => void;
}

const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length,
    );
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="rounded-2xl p-1 flex flex-col gap-1 bg-white shadow-lg border text-sm font-medium max-w-56">
      {props.items.map((item, index) => (
        <Button
          key={item.id}
          variant={selectedIndex === index ? "special" : "ghost"}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => selectItem(index)}
          className="w-full line-clamp-1 text-left"
        >
          @{item.name}
        </Button>
      ))}
    </div>
  );
});

MentionList.displayName = "MentionList";

export default MentionList;
