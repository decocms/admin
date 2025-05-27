import {
  DEFAULT_MODEL_PREFIX,
  type Model,
  useCreateModel,
  useModels,
  useUpdateModel,
} from "@deco/sdk";
import { Suspense } from "react";
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

function ModelCard({ model }: ModelCardProps) {
  const updateModel = useUpdateModel();
  const createModel = useCreateModel();

  const navigateWorkspace = useNavigateWorkspace();

  async function handleNavigation() {
    if (model.id.startsWith(DEFAULT_MODEL_PREFIX)) {
      const newModel = await createModel.mutateAsync({
        model: model.model,
        name: model.name,
        description: model.description,
        byDeco: true,
        isEnabled: true,
      });

      navigateWorkspace(`/model/${newModel.id}`);
    } else {
      navigateWorkspace(`/model/${model.id}`);
    }
  }

  return (
    <div
      className="flex items-center justify-between p-4 border rounded-lg text-start cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleNavigation}
    >
      <div className="flex items-center gap-3">
        {model.logo && (
          <div
            className={cn(
              "rounded-2xl relative flex items-center justify-center p-2 h-16 w-16",
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
            {model.hasCustomKey && (
              <Tooltip>
                <TooltipTrigger className="flex">
                  <Icon name="key" className="h-4 w-4 text-slate-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>This model has a custom API key</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="text-sm text-slate-500">{model.model}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}

function Models() {
  const { data: models, isLoading } = useModels({ excludeAuto: true });
  const navigateWorkspace = useNavigateWorkspace();

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
              onClick={() => navigateWorkspace("/model/new")}
            >
              <Icon name="add" className="mr-2 h-4 w-4" />
              Add Model
            </Button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {isLoading ? <p>Loading custom models...</p> : models.length > 0
                ? (
                  models.map((model) => (
                    <ModelCard key={model.id} model={model} />
                  ))
                )
                : null}
            </div>
          </div>
        </div>
      </Suspense>
    </ScrollArea>
  );
}

export default Models;
