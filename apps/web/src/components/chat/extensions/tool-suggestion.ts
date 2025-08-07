import { type Tool } from "../rich-text.tsx";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import tippy, { type Instance, type Props } from "tippy.js";

export interface ToolOption {
  id: string;
  type: "tool";
  label: string;
  description?: string;
  tool: Tool;
}

export const suggestion: (
  tools: Tool[],
) => Partial<SuggestionOptions<ToolOption>> = (tools) => {
  return {
    char: "@",
    items: (props) => {
      const { query } = props;

      const filteredTools = tools.filter((tool) => {
        const matchesQuery =
          tool.name.toLowerCase().includes(query?.toLowerCase() ?? "") ||
          tool.description
            ?.toLowerCase()
            .includes(query?.toLowerCase() ?? "") ||
          tool.integration.name
            .toLowerCase()
            .includes(query?.toLowerCase() ?? "");

        return matchesQuery;
      });

      return filteredTools
        .map(
          (tool): ToolOption => ({
            id: tool.id,
            type: "tool",
            label: tool.name,
            description: tool.description,
            tool,
          }),
        )
        .slice(0, 10);
    },
    render: () => {
      let component: ReactRenderer | null = null;
      let popup: Instance<Props>[] | null = null;

      return {
        onStart: async (props) => {
          if (component) {
            component.destroy();
          }

          const { default: ToolMentionDropdown } = await import(
            "./tool-mention-dropdown.tsx"
          );

          component = new ReactRenderer(ToolMentionDropdown, {
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
            placement: "top-start",
            maxWidth: 400,
          });
        },

        onUpdate(props) {
          component?.updateProps(props);

          popup?.[0]?.setProps({
            // @ts-expect-error - tippy is not well typed
            getReferenceClientRect: props.clientRect,
          });
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }

          // @ts-expect-error - component.ref is not typed
          return component?.ref?.onKeyDown(props);
        },

        onExit() {
          popup?.[0]?.destroy?.();
          component?.destroy?.();
        },
      };
    },
  };
};
