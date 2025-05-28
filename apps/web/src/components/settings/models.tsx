import {
  DEFAULT_MODEL_PREFIX,
  type Model,
  useCreateModel,
  useModels,
  useUpdateModel,
} from "@deco/sdk";
import { Suspense, useState } from "react";
import { Button } from "../../../../../packages/ui/src/components/button.tsx";
import { Icon } from "../../../../../packages/ui/src/components/icon.tsx";
import { ScrollArea } from "../../../../../packages/ui/src/components/scroll-area.tsx";
import { Switch } from "../../../../../packages/ui/src/components/switch.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../../../packages/ui/src/components/tooltip.tsx";
import { cn } from "../../../../../packages/ui/src/lib/utils.ts";
import { useNavigateWorkspace } from "../../hooks/useNavigateWorkspace.ts";
import { Avatar } from "../common/Avatar.tsx";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import { Table, TableColumn } from "../common/Table.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../../packages/ui/src/components/dropdown-menu.tsx";

const SORTABLE_KEYS = ["name", "active", "APIKey"] as const;

type SortKey = typeof SORTABLE_KEYS[number];
type SortDirection = "asc" | "desc";

function Title() {
  return (
    <div className="items-center justify-between hidden md:flex">
      <h2 className="text-2xl">Models</h2>
    </div>
  );
}

interface ModelCardProps {
  model: Model;
}

function Models() {
  const { data: models } = useModels({ excludeAuto: true });
  const navigateWorkspace = useNavigateWorkspace();

  const newWorkspace = () => {
    navigateWorkspace("/model/new");
  };

  return (
    <ScrollArea className="h-full text-slate-700">
      <SettingsMobileHeader currentPage="models" />
      <Suspense fallback={<span>Loading...</span>}>
        <div className="px-6 py-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Title />
            <Button
              variant="default"
              className="ml-auto"
              onClick={newWorkspace}
            >
              <Icon name="add" className="mr-2 h-4 w-4" />
              Add Model
            </Button>
          </div>

          <div className="space-y-6">
            <TableView models={models} />
          </div>
        </div>
      </Suspense>
    </ScrollArea>
  );
}

const KeyCell = (
  { model, onClick }: { model: Model; onClick: () => void },
) => {
  if (model.byDeco) {
    return (
      <Button variant="outline" onClick={onClick}>
        Add Custom Key
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-2 px-4 py-2" onClick={onClick}>
      <Icon name="key" /> Custom Key
    </span>
  );
};

const ModelActions = (
  { model, editModel }: { model: Model; editModel: () => void },
) => {
  if (model.byDeco) {
    return undefined;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="more_vert" size={20} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            editModel();
          }}
        >
          <Icon name="edit" className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            // onOpenChange(true);
          }}
        >
          <Icon name="delete" className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ModelInfoCell = (
  { model }: { model: Model },
) => {
  return (
    <div className="flex items-center gap-2">
      {model.logo && (
        <div
          className={cn(
            "rounded-xl relative flex items-center justify-center p-2 h-10 w-10",
            "before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-t before:from-slate-300 before:to-slate-100",
            "before:![mask:linear-gradient(#000_0_0)_exclude_content-box,_linear-gradient(#000_0_0)]",
          )}
        >
          {model.logo
            ? (
              <Avatar
                url={model.logo}
                fallback={model.name}
                fallbackClassName="!bg-transparent"
                className="w-full h-full rounded-lg"
                objectFit="contain"
              />
            )
            : <Icon name="conversion_path" className="text-slate-600" />}
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-medium line-clamp-1">{model.name}</h3>
        </div>
        <p className="text-sm text-slate-500">{model.model}</p>
      </div>
    </div>
  );
};

function TableView(
  { models }: { models: Model[] },
) {
  const [sortKey, setSortKey] = useState<SortKey>("active");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  const navigateWorkspace = useNavigateWorkspace();
  const updateModel = useUpdateModel();
  const createModel = useCreateModel();

  async function handleNavigation(model: Model) {
    if (model.id.startsWith(DEFAULT_MODEL_PREFIX)) {
      const newModel = await createModel.mutateAsync({
        model: model.model,
        name: `${model.name} - Team`,
        description: model.description,
        byDeco: false,
        isEnabled: true,
      });

      navigateWorkspace(`/model/${newModel.id}`);
    } else {
      navigateWorkspace(`/model/${model.id}`);
    }
  }

  function handleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDirection("asc");
    }
  }

  function getSortValue(
    model: Model,
    key: SortKey,
  ): string {
    if (key === "name") return model.name?.toLowerCase() || "";
    if (key === "active") return model.isEnabled ? "1" : "0";
    if (key === "APIKey") return model.hasCustomKey ? "1" : "0";
    return "";
  }

  const sortedModels = [...models]
    .sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  const columns: TableColumn<Model>[] = [
    {
      id: "active",
      header: "",
      render: (model) => (
        <Switch
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          checked={model.isEnabled}
          onCheckedChange={(checked: boolean) =>
            model.id.startsWith(DEFAULT_MODEL_PREFIX)
              ? createModel.mutate({
                model: model.model,
                name: model.name,
                description: model.description,
                byDeco: true,
                isEnabled: checked,
              })
              : updateModel.mutate({
                id: model.id,
                data: { isEnabled: checked },
              })}
        />
      ),
    },
    {
      id: "name",
      header: "Name",
      accessor: (model) => <ModelInfoCell model={model} />,
      sortable: true,
    },
    {
      id: "APIKey",
      header: "API Key",
      render: (model) => (
        <KeyCell
          model={model}
          onClick={() => handleNavigation(model)}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      render: (model) => (
        <ModelActions
          model={model}
          editModel={() => handleNavigation(model)}
        />
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={sortedModels}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
    />
  );
}

export default Models;