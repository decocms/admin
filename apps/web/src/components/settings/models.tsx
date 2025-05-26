import {
  type CreateModelInput,
  DEFAULT_MODEL,
  type Model,
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

const ModelFormSchema = z.object({
  label: z.string().min(1, "Name is required"),
  model: z.string().min(1, "Model identifier is required"),
  api_key: z.string().min(1, "API key is required"),
});

type ModelFormData = z.infer<typeof ModelFormSchema>;

function Title() {
  return (
    <div className="items-center justify-between hidden md:flex">
      <h2 className="text-2xl">Models</h2>
    </div>
  );
}

function AddModelDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof ModelFormSchema>>({
    resolver: zodResolver(ModelFormSchema),
  });
  const { workspace } = useSDK();
  const createModel = useCreateModel();

  const onSubmit = async (data: ModelFormData) => {
    const input: CreateModelInput = {
      ...data,
      workspace,
      is_enabled: true,
    };
    await createModel.mutateAsync(input);
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="ml-auto">
          <Icon name="add" className="mr-2 h-4 w-4" />
          Add Model
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Model</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Custom GPT-4" {...field} />
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
                    <Input placeholder="gpt-4-turbo" {...field} />
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
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Add Model
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function isCustomModel(model: Model | CustomModel): model is CustomModel {
  return "label" in model && "api_key_hash" in model;
}

interface ModelCardProps {
  model: Model | CustomModel;
  isCustom?: boolean;
}

function ModelCard({ model }: ModelCardProps) {
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();

  if (isCustomModel(model)) {
    return (
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-medium">{model.label}</h3>
            <p className="text-sm text-slate-500">{model.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={model.is_enabled}
            onCheckedChange={(checked: boolean) =>
              updateModel.mutate({
                id: model.id,
                data: { is_enabled: checked },
              })}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteModel.mutate(model.id)}
          >
            <Icon name="delete" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        {model.logo && (
          <img src={model.logo} alt={model.name} className="w-6 h-6" />
        )}
        <div>
          <h3 className="font-medium">{model.name}</h3>
          <p className="text-sm text-slate-500">{model.id}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={model.is_enabled}
          onCheckedChange={(checked: boolean) =>
            updateModel.mutate({
              id: model.id,
              data: { is_enabled: checked },
            })}
        />
      </div>
    </div>
  );
}

function Models() {
  const { data: models, isLoading } = useModels();

  return (
    <ScrollArea className="h-full text-slate-700">
      <SettingsMobileHeader currentPage="models" />
      <Suspense fallback={<span>Loading...</span>}>
        <div className="px-6 py-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Title />
            <AddModelDialog />
          </div>

          <div className="space-y-6">
            <div className="grid gap-4">
              {MODELS.filter((m) => m.id !== DEFAULT_MODEL).map((model) => (
                <ModelCard key={model.id} model={model} />
              ))}

              {isLoading ? <p>Loading custom models...</p> : models.length > 0
                ? (
                  models.map((
                    model,
                  ) => <ModelCard key={model.id} model={model} isCustom />)
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
