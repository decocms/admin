import type { Prompt, PinnedItem } from "@deco/sdk";
import type { TableColumn } from "@deco/ui/components/collection-table.tsx";
import { TimeAgoCell } from "../common/table/table-cells.tsx";
import type { CustomRowAction } from "../resources-v2/list.tsx";

/**
 * Adapter to transform Prompt to a format compatible with ResourcesV2List
 */
export function adaptPrompt(prompt: Prompt): Record<string, unknown> {
  return {
    id: prompt.id,
    uri: `legacy-prompt://${prompt.id}`,
    // For compatibility with ResourceListItem structure
    data: {
      name: prompt.name || "Untitled document",
      description: prompt.description || prompt.content || "",
    },
    created_at: prompt.created_at,
    updated_at: prompt.created_at, // Prompts don't have updated_at, use created_at
    // Store original prompt for row actions
    _prompt: prompt,
  };
}

/**
 * Get columns for prompts table - matches ResourcesV2List style
 */
export function getPromptsColumns(): TableColumn<Record<string, unknown>>[] {
  return [
    {
      id: "title",
      header: "Name",
      accessor: (row) => {
        const item = row as Record<string, unknown>;
        const data = item.data as Record<string, unknown> | undefined;
        return (data?.name as string) || "";
      },
      cellClassName: "max-w-3xs font-medium",
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      accessor: (row) => {
        const item = row as Record<string, unknown>;
        const data = item.data as Record<string, unknown> | undefined;
        return (data?.description as string) || "";
      },
      cellClassName: "max-w-xl",
      sortable: true,
    },
    {
      id: "updated_at",
      header: "Updated",
      render: (row) => {
        const item = row as Record<string, unknown>;
        return <TimeAgoCell value={item.updated_at as string} />;
      },
      cellClassName: "whitespace-nowrap min-w-30",
      sortable: true,
    },
  ];
}

/**
 * Get custom row actions for prompts (delete)
 */
export function getPromptRowActions(
  onDelete: (prompt: Prompt) => void,
  _isPinned: (id: string) => boolean,
  _togglePin: (resource: Omit<PinnedItem, "pinned_at">) => void,
): (item: Record<string, unknown>) => CustomRowAction[] {
  return (item: Record<string, unknown>) => {
    const prompt = (item._prompt as Prompt) || (item as unknown as Prompt);

    return [
      {
        label: "Delete",
        icon: "delete",
        variant: "destructive",
        onClick: () => onDelete(prompt),
      },
    ];
  };
}
