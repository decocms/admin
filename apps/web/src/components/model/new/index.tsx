import { useCreateModel } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigateWorkspace } from "../../../hooks/useNavigateWorkspace.ts";
import type { Tab } from "../../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../../layout.tsx";
import { Context, CreateModelInput, createModelSchema } from "./context.ts";
import { DetailForm } from "./form.tsx";

const TABS: Record<string, Tab> = {
  form: {
    Component: DetailForm,
    title: "Setup",
    initialOpen: true,
  },
};

export default function Page() {
  const form = useForm<CreateModelInput>({
    resolver: zodResolver(createModelSchema),
    defaultValues: {
      name: "",
      model: "",
    },
  });

  const createModel = useCreateModel();
  const isMutating = createModel.isPending;

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;

  const handleDiscard = () => form.reset();
  const navigateWorkspace = useNavigateWorkspace();

  const onSubmit = async (data: CreateModelInput) => {
    try {
      const newModel = await createModel.mutateAsync({
        model: data.model,
        name: data.name,
        apiKey: data.apiKey,
        description: data.description,
        byDeco: false,
        isEnabled: true,
      });

      form.reset(data);

      navigateWorkspace(`/model/${newModel.id}`);
    } catch (error) {
      console.error(
        `Error updating model:`,
        error,
      );
    }
  };

  return (
    <Context.Provider value={{ form, onSubmit }}>
      <PageLayout
        tabs={TABS}
        actionButtons={
          <div
            className={cn(
              "flex items-center gap-2",
              "transition-opacity",
              numberOfChanges > 0 ? "opacity-100" : "opacity-0",
            )}
          >
            <Button
              type="button"
              variant="outline"
              className="text-slate-700"
              onClick={handleDiscard}
            >
              Discard
            </Button>
            <Button
              className="bg-primary-light text-primary-dark hover:bg-primary-light/90 gap-2"
              disabled={!numberOfChanges}
              onClick={() => {
                onSubmit(form.getValues());
              }}
            >
              {isMutating
                ? (
                  <>
                    <Spinner size="xs" />
                    <span>Creating...</span>
                  </>
                )
                : <span>Create Model</span>}
            </Button>
          </div>
        }
        breadcrumb={
          <DefaultBreadcrumb
            items={[
              { label: "Models" },
              { label: "New" },
            ]}
          />
        }
      />
    </Context.Provider>
  );
}
