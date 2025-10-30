import type { SuggestionProps } from "@tiptap/suggestion";
import React, { forwardRef, useImperativeHandle, useMemo } from "react";
import type { MentionItem, Tool } from "../types.ts";
import { ContextPicker } from "../../chat/context-picker.tsx";
import { useIntegrations } from "@deco/sdk";

interface MentionDropdownProps {
  items: MentionItem[]; // Not used anymore, ContextPicker fetches its own data
  command: (item: MentionItem) => void;
  editor: unknown;
  isLoading?: boolean;
  pendingCategories?: string[]; // keys: `${integrationId}:${resourceType}`
  // oxlint-disable-next-line no-explicit-any
  IntegrationAvatar?: React.ComponentType<any>;
  onClose?: () => void; // Callback to close the TipTap suggestion popup
}

type MentionDropdownRef = { onKeyDown: (props: SuggestionProps) => boolean };

export const MentionDropdown = forwardRef<
  MentionDropdownRef,
  MentionDropdownProps
>(function MentionDropdown(props, ref) {
  const { items: _items, command, editor, onClose } = props;
  const { data: integrations = [] } = useIntegrations();

  // Use the onClose callback passed from TipTap
  const handleClose = React.useCallback(() => {
    console.log("MentionDropdown: handleClose called");
    onClose?.();

    // Refocus the editor after closing
    setTimeout(() => {
      // @ts-expect-error - TipTap editor commands not typed
      if (editor?.commands?.focus) {
        // @ts-expect-error
        editor.commands.focus();
      }
    }, 0);
  }, [onClose, editor]);

  // Don't provide items - let ContextPicker fetch integrations AND documents itself
  // This way both @ and + show the same content (MCPs + Documents)
  const contextItems = useMemo(() => {
    // Return undefined so ContextPicker fetches its own data
    return undefined;
  }, []);

  // Handle tool selection - insert mention into editor
  const handleAddTools = React.useCallback(
    (toolIds: string[]) => {
      toolIds.forEach((toolId) => {
        const [integrationId, toolName] = toolId.split(":");
        const integration = integrations.find((i) => i.id === integrationId);
        const toolDef = integration?.tools?.find((t) => t.name === toolName);

        if (toolDef && integration) {
          const fullTool: Tool = {
            id: `${integration.id}:${toolDef.name}`,
            name: toolDef.name,
            description: toolDef.description,
            inputSchema: toolDef.inputSchema,
            outputSchema: toolDef.outputSchema,
            integration: {
              id: integration.id,
              name: integration.name,
              icon: integration.icon,
            },
          };
          const mentionItem: MentionItem = {
            id: fullTool.id,
            type: "tool",
            label: fullTool.name,
            description: fullTool.description,
            tool: fullTool,
          };
          command(mentionItem);
        }
      });
    },
    [command, integrations],
  );

  // Handle single tool selection (for inline mentions)
  const handleSelectItem = React.useCallback(
    (toolId: string, type: "tool" | "resource") => {
      if (type === "tool") {
        const [integrationId, toolName] = toolId.split(":");
        const integration = integrations.find((i) => i.id === integrationId);
        const toolDef = integration?.tools?.find((t) => t.name === toolName);

        if (toolDef && integration) {
          const fullTool: Tool = {
            id: `${integration.id}:${toolDef.name}`,
            name: toolDef.name,
            description: toolDef.description,
            inputSchema: toolDef.inputSchema,
            outputSchema: toolDef.outputSchema,
            integration: {
              id: integration.id,
              name: integration.name,
              icon: integration.icon,
            },
          };
          const mentionItem: MentionItem = {
            id: fullTool.id,
            type: "tool",
            label: fullTool.name,
            description: fullTool.description,
            tool: fullTool,
          };
          command(mentionItem);
        }
      }
      // TODO: Handle resource type for documents
    },
    [command, integrations],
  );

  // Handle keyboard events for TipTap
  useImperativeHandle(ref, () => ({
    onKeyDown: (_props: SuggestionProps) => {
      // TipTap handles most keyboard events, but we need to return false
      // to let it pass through to ContextPicker's internal keyboard handler
      // ContextPicker will handle its own keyboard navigation
      return false;
    },
  }));

  return (
    <ContextPicker
      open={true}
      onClose={handleClose}
      onAddTools={handleAddTools}
      onSelectItem={handleSelectItem}
      items={contextItems}
    />
  );
});
