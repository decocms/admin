import {
  CreateModelInput,
  DEFAULT_MODEL,
  DEFAULT_MODEL_PREFIX,
  Model,
  MODELS,
  useCreateModel,
  useDeleteModel,
  useModels,
  useSDK,
  useUpdateModel,
} from "@deco/sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../../../../packages/ui/src/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../../packages/ui/src/components/dialog.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../packages/ui/src/components/form.tsx";
import { Icon } from "../../../../../packages/ui/src/components/icon.tsx";
import { Input } from "../../../../../packages/ui/src/components/input.tsx";
import { ScrollArea } from "../../../../../packages/ui/src/components/scroll-area.tsx";
import { Switch } from "../../../../../packages/ui/src/components/switch.tsx";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../packages/ui/src/components/select.tsx";

const ModelFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  model: z.string().min(1, "Model identifier is required"),
  api_key: z.string().min(1, "API key is required"),
  description: z.string().optional(),
});

type ModelFormData = z.infer<typeof ModelFormSchema>;

function Title() {
  return (
    <div className="items-center justify-between hidden md:flex">
      <h2 className="text-2xl">Models</h2>
    </div>
  );
}

function AddModelDialog(
  { trigger, triggerAsChild, isCustom, model, isEdit }: {
    trigger?: React.ReactNode;
    triggerAsChild?: boolean;
    isCustom?: boolean;
    model?: Model;
    isEdit?: boolean;
  },
) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof ModelFormSchema>>({
    resolver: zodResolver(ModelFormSchema),
    defaultValues: {
      name: model?.name,
      model: model?.model,
      api_key: "",
      description: model?.description,
    },
  });
  const { workspace } = useSDK();
  const createModel = useCreateModel();
  const updateModel = useUpdateModel();

  const onSubmit = async (data: ModelFormData) => {
    const input: CreateModelInput = {
      ...data,
      workspace,
      isEnabled: true,
      byDeco: !isCustom,
    };

    if (model && model.id.startsWith(DEFAULT_MODEL_PREFIX)) {
      await updateModel.mutateAsync({
        id: model.id,
        data: input,
      });
    } else {
      await createModel.mutateAsync(input);
    }
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild={triggerAsChild}>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Model" : "Add Model"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Custom GPT-4"
                      {...field}
                      disabled={!isCustom && isEdit}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Identifier</FormLabel>
                  <FormControl>
                    <Select
                      {...field}
                      disabled={!isCustom && isEdit}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder="Select Model"
                          defaultValue={model?.model}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {MODELS.filter((m) => m.model !== DEFAULT_MODEL).map((
                          model,
                        ) => (
                          <SelectItem key={model.model} value={model.model}>
                            {model.logo && (
                              <img
                                src={model.logo}
                                alt={model.name}
                                className="w-6 h-6"
                              />
                            )}
                            {model.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    The model identifier used by the API
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      placeholder={model?.hasCustomKey ? "********" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2 w-full justify-end">
              {isEdit && (
                <Button
                  variant="outline"
                  type="button"
                  className=""
                  onClick={() => {
                    setOpen(false);
                    form.reset();
                  }}
                >
                  Discard Changes
                </Button>
              )}
              <Button type="submit" className="">
                {isEdit ? "Update Model" : "Add Model"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface ModelCardProps {
  model: Model;
  isCustom?: boolean;
}

function ModelCard({ model }: ModelCardProps) {
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg text-start">
      <div className="flex items-center gap-3">
        {model.logo && (
          <img src={model.logo} alt={model.name} className="w-6 h-6" />
        )}
        <div>
          <h3 className="font-medium">{model.name}</h3>
          <p className="text-sm text-slate-500">{model.model}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {model.hasCustomKey && (
          <Icon name="key" className="h-4 w-4 text-slate-500" />
        )}
        <Switch
          onClick={(e) => e.stopPropagation()}
          checked={model.isEnabled}
          onCheckedChange={(checked: boolean) =>
            updateModel.mutate({
              id: model.id,
              data: { isEnabled: checked },
            })}
        />
        {!model.byDeco && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteModel.mutate(model.id)}
          >
            <Icon name="delete" className="h-4 w-4 text-red-500" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Models() {
  const { data: models, isLoading } = useModels({ excludeAuto: true });

  return (
    <ScrollArea className="h-full text-slate-700">
      <SettingsMobileHeader currentPage="models" />
      <Suspense fallback={<span>Loading...</span>}>
        <div className="px-6 py-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Title />
            <AddModelDialog
              triggerAsChild
              trigger={
                <Button variant="default" className="ml-auto">
                  <Icon name="add" className="mr-2 h-4 w-4" />
                  Add Model
                </Button>
              }
            />
          </div>

          <div className="space-y-6">
            <div className="grid gap-4">
              {isLoading ? <p>Loading custom models...</p> : models.length > 0
                ? (
                  models.map((
                    model,
                  ) => (
                    <AddModelDialog
                      key={model.id}
                      isCustom={!model.byDeco}
                      model={model}
                      isEdit
                      trigger={
                        <ModelCard model={model} isCustom={!model.byDeco} />
                      }
                    />
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
