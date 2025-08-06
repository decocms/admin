import { ScrollArea, ScrollBar } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { SuggestionProps } from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useAgentSettingsToolsSet } from "../../../hooks/use-agent-settings-tools-set.ts";
import { IntegrationAvatar } from "../../common/avatar/integration.tsx";
import { type ToolOption } from "./tool-suggestion.ts";

interface ToolMentionDropdownProps {
  items: ToolOption[];
  command: (item: ToolOption) => void;
  editor: unknown;
}

export default forwardRef<
  { onKeyDown: (props: SuggestionProps) => boolean },
  ToolMentionDropdownProps
>(function ToolMentionDropdown({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { setIntegrationTools } = useAgentSettingsToolsSet();
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      command(item);

      // Add the specific tool to the agent
      setIntegrationTools(item.tool.integration.id, [item.tool.name]);
    }
  };

  const scrollSelectedIntoView = (index: number) => {
    const selectedElement = itemRefs.current[index];
    if (selectedElement && scrollAreaRef.current) {
      selectedElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  };

  const upHandler = () => {
    const newIndex = (selectedIndex + items.length - 1) % items.length;
    setSelectedIndex(newIndex);
    scrollSelectedIntoView(newIndex);
  };

  const downHandler = () => {
    const newIndex = (selectedIndex + 1) % items.length;
    setSelectedIndex(newIndex);
    scrollSelectedIntoView(newIndex);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
    // Reset refs array when items change
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (props: SuggestionProps) => {
      const event = (props as { event?: KeyboardEvent }).event;

      if (event?.key === "ArrowUp") {
        event.preventDefault();
        upHandler();
        return true;
      }

      if (event?.key === "ArrowDown") {
        event.preventDefault();
        downHandler();
        return true;
      }

      if (event?.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[300px] overflow-hidden">
        <div className="text-sm text-muted-foreground">No tools found</div>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg min-w-[300px] max-w-[400px] overflow-hidden">
      <ScrollArea
        className="h-[300px] w-full max-w-[400px]"
        ref={scrollAreaRef}
      >
        <div className="p-1 max-w-[400px]">
          {items.map((item, index) => (
            <button
              type="button"
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className={cn(
                "flex items-center gap-3 w-full p-2 rounded-md text-left transition-colors",
                "hover:bg-muted/50",
                selectedIndex === index && "bg-muted",
              )}
              onClick={() => selectItem(index)}
            >
              <IntegrationAvatar
                url={item.tool.integration.icon}
                fallback={item.tool.integration.name}
                size="sm"
                className="flex-shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1 max-w-[320px]">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <span className="truncate">{item.tool.name}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {item.tool.integration.name}
                  </span>
                </div>
                {item.tool.description && (
                  <span className="text-xs text-muted-foreground truncate">
                    {item.tool.description}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
});
