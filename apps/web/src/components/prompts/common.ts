import { Prompt } from "@deco/sdk";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { MentionDropdown } from "./mention-dropdown.tsx";

const suggestion: (items: Prompt[]) => Partial<SuggestionOptions> = (items) => {
  return {
    char: "@",
    items: ({ query }) => {
      return items.filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase())
      )
        .slice(0, 5);
    },
    render: () => {
      let component: ReactRenderer<typeof MentionDropdown>;
      let popup: HTMLElement;

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionDropdown, {
            props,
            editor: props.editor,
          });

          popup = document.createElement("div");
          popup.classList.add("mention-popup");

          const top = props.clientRect?.()?.top || 0;
          const left = props.clientRect?.()?.left || 0;

          Object.assign(popup.style, {
            position: "absolute",
            top: `${top + globalThis.window.scrollY + 30}px`,
            left: `${left + globalThis.window.scrollX}px`,
            zIndex: 9999,
          });
          popup.appendChild(component.element);
          document.body.appendChild(popup);
        },
        onUpdate(props) {
          component.updateProps(props);

          const top = props.clientRect?.()?.top || 0;
          const left = props.clientRect?.()?.left || 0;

          Object.assign(popup.style, {
            top: `${top + globalThis.window.scrollY + 30}px`,
            left: `${left + globalThis.window.scrollX}px`,
          });
        },
        onKeyDown(props) {
          if (props.event.key === "Enter") {
            component.element.dispatchEvent(props.event);
            return true;
          }
          return false;
        },
        onExit() {
          component?.destroy();
          popup?.remove();
        },
      };
    },
  };
};

export default suggestion;
