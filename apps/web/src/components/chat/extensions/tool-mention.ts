import { type Tool } from "../rich-text.tsx";
import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { suggestion } from "./tool-suggestion.ts";
import ToolMentionNode from "./tool-mention-node.tsx";

export const toolMentions = (args: {
  tools: Tool[];
  resourceSearchers: Array<{
    integration: { id: string; name: string; icon?: string };
    connection: unknown;
    searchToolNames: string[];
  }>;
}) => {
  const { tools, resourceSearchers } = args;
  const toolMap = new Map<string, Tool>(tools.map((tool) => [tool.id, tool]));

  return Mention.extend({
    addNodeView() {
      return ReactNodeViewRenderer(ToolMentionNode);
    },
    addAttributes() {
      return {
        type: { default: "tool-mention" },
        id: { default: "" },
        label: { default: "" },
        mentionType: { default: "tool" },
      };
    },
    parseHTML() {
      return [
        {
          tag: 'span[data-type="tool-mention"]',
          getAttrs: (node) => {
            if (!(node instanceof HTMLElement)) return false;

            const id = node.getAttribute("data-id");
            if (!id) return false;

            const tool = toolMap.get(id);
            return {
              id,
              mentionType: node.getAttribute("data-mention-type"),
              label: tool?.name || id,
            };
          },
        },
      ];
    },
    renderHTML({ node }) {
      return [
        "span",
        {
          "data-type": "tool-mention",
          "data-id": node.attrs.id,
          "data-mention-type": node.attrs.mentionType,
        },
        `@${node.attrs.label}`,
      ];
    },
  }).configure({
    suggestion: suggestion({ tools, resourceSearchers }),
    renderText({ node }) {
      const tool = toolMap.get(node.attrs.id);
      return tool ? `@${tool.name}` : `@${node.attrs.id}`;
    },
  });
};
