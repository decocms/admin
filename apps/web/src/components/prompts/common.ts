import { Prompt } from "@deco/sdk";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import tippy from "tippy.js";
import MentionDropdown from "../mention/dropdown.tsx";

const suggestion: (items: Prompt[]) => Partial<SuggestionOptions> = (items) => {
  return {
    char: "/",
    items: ({ query }) => {
      return [
        {
          name: "Prompts",
          options: items.map((item) => ({
            id: item.id,
            label: item.name,
          })).filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 5),
        },
      ];
    },
    render: () => {
      let component: ReactRenderer<unknown> | null = null;
      let popup: tippy.Instance | null = null;

      return {
        onStart: (props) => {
          if (component) {
            component.destroy();
          }

          component = new ReactRenderer(MentionDropdown, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          // @ts-expect-error - tippy is not well typed
          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component?.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },

        onUpdate(props) {
          component?.updateProps(props);
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup?.destroy?.();
            component?.destroy?.();

            return true;
          }

          // @ts-expect-error - component.ref is not typed
          return component?.ref?.onKeyDown(props);
        },

        onExit() {
          popup?.destroy?.();
          component?.destroy?.();
        },
      };
    },
  };
};

export default suggestion;
