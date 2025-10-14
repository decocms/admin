import {
  type Prompt,
  useCreatePrompt,
  useDeletePrompt,
  usePrompts,
} from "@deco/sdk";
import { isWellKnownPromptId } from "@deco/sdk/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useReducer, useState } from "react";
import { useNavigateWorkspace } from "../../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../../common/empty-state.tsx";
import { Table, type TableColumn } from "../../common/table/index.tsx";

interface ListState {
  deleteDialogOpen: boolean;
  promptToDelete: string | null;
  deleting: boolean;
}

type ListAction =
  | { type: "CONFIRM_DELETE"; payload: string }
  | { type: "CANCEL_DELETE" }
  | { type: "DELETE_START" }
  | { type: "DELETE_END" };

const initialState: ListState = {
  deleteDialogOpen: false,
  promptToDelete: null,
  deleting: false,
};

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "CONFIRM_DELETE": {
      return {
        ...state,
        deleteDialogOpen: true,
        promptToDelete: action.payload,
      };
    }
    case "CANCEL_DELETE": {
      return { ...state, deleteDialogOpen: false, promptToDelete: null };
    }
    case "DELETE_START": {
      return { ...state, deleting: true };
    }
    case "DELETE_END": {
      return {
        ...state,
        deleting: false,
        deleteDialogOpen: false,
        promptToDelete: null,
      };
    }
    default: {
      return state;
    }
  }
}

interface PromptActionsProps {
  onDelete: () => void;
  disabled?: boolean;
}
function PromptActions({ onDelete, disabled }: PromptActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="focus:bg-accent/30"
          disabled={disabled}
        >
          <Icon name="more_vert" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:bg-destructive/10"
        >
          <Icon name="delete" className="mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PromptCard({
  prompt,
  onConfigure,
  onDelete,
}: {
  prompt: Prompt;
  onConfigure: (prompt: Prompt) => void;
  onDelete: (promptId: string) => void;
}) {
  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
      onClick={() => onConfigure(prompt)}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[1fr_min-content] gap-4 items-start">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="text-base font-semibold truncate">
              {prompt.name || "Untitled document"}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-3">
              {prompt.description || prompt.content}
            </div>
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <PromptActions onDelete={() => onDelete(prompt.id)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TableView({
  prompts,
  onConfigure,
  onDelete,
}: {
  prompts: Prompt[];
  onConfigure: (prompt: Prompt) => void;
  onDelete: (promptId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: Prompt, key: string): string {
    if (key === "description") return row.description?.toLowerCase() || "";
    return row.name?.toLowerCase() || "";
  }
  const sortedPrompts = [...prompts].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<Prompt>[] = [
    {
      id: "name",
      header: "Name",
      render: (prompt) => prompt.name || "Untitled prompt",
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      accessor: (prompt) => prompt.description || prompt.content,
      sortable: true,
      cellClassName: "max-w-md",
    },
    {
      id: "actions",
      header: "",
      render: (prompt) => (
        <div onClick={(e) => e.stopPropagation()}>
          <PromptActions onDelete={() => onDelete(prompt.id)} />
        </div>
      ),
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <Table
      columns={columns}
      data={sortedPrompts}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onConfigure}
    />
  );
}

interface ListPromptsProps {
  searchTerm?: string;
  viewMode?: "cards" | "table";
}

function ListPrompts({
  searchTerm = "",
  viewMode = "cards",
}: ListPromptsProps) {
  const [state, dispatch] = useReducer(listReducer, initialState);
  const { data: prompts } = usePrompts();
  const create = useCreatePrompt();
  const deletePrompt = useDeletePrompt();
  const navigateWorkspace = useNavigateWorkspace();

  const { deleteDialogOpen, promptToDelete, deleting } = state;

  const search = (searchTerm ?? "").toLowerCase();
  const filteredPrompts =
    prompts?.filter(
      (prompt) =>
        (prompt.name ?? "").toLowerCase().includes(search) &&
        !isWellKnownPromptId(prompt.id),
    ) ?? [];

  const handleConfigure = (prompt: Prompt) => {
    navigateWorkspace(`/documents/${prompt.id}`);
  };
  const handleDeleteConfirm = (promptId: string) => {
    dispatch({ type: "CONFIRM_DELETE", payload: promptId });
  };
  const handleDelete = async () => {
    if (!promptToDelete) return;

    try {
      dispatch({ type: "DELETE_START" });

      await deletePrompt.mutateAsync(promptToDelete);
    } catch (error) {
      console.error("Error deleting prompt:", error);
    } finally {
      dispatch({ type: "DELETE_END" });
    }
  };
  const _handleCreate = async () => {
    const result = await create.mutateAsync({
      name: "",
      content: "",
    });
    navigateWorkspace(`/documents/${result.id}`);
  };
  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !deleting) {
      dispatch({ type: "CANCEL_DELETE" });
    }
  };

  return (
    <>
      {!prompts ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : filteredPrompts.length === 0 ? (
        <EmptyState
          icon="local_library"
          title="No documents yet"
          description="Create a document to get started."
        />
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onConfigure={handleConfigure}
              onDelete={handleDeleteConfirm}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-16 px-16">
          <div className="w-fit min-w-full max-w-[1500px] mx-auto">
            <TableView
              prompts={filteredPrompts}
              onConfigure={handleConfigure}
              onDelete={handleDeleteConfirm}
            />
          </div>
        </div>
      )}

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the document. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deleting ? (
                <>
                  <Spinner />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ListPrompts;
