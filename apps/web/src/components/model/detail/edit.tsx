import { useModel, useUpdateModel } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import type { Tab } from "../../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../../layout.tsx";
import { Context, UpdateModelInput, updateModelSchema } from "./context.ts";
import { DetailForm } from "./form.tsx";

const TABS: Record<string, Tab> = {
  form: {
    Component: DetailForm,
    title: "Setup",
    initialOpen: true,
  },
};

export default function Page() {
  const { id } = useParams();
  const modelId = id!;
  const { data: model } = useModel(modelId);

  const form = useForm<UpdateModelInput>({
    resolver: zodResolver(updateModelSchema),
    defaultValues: {
      name: model.name,
      description: model.description,
      model: model.model,
      isEnabled: model.isEnabled,
    },
  });

  const updateModel = useUpdateModel();
  const isMutating = updateModel.isPending;

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;

  const handleDiscard = () => form.reset(model);

  const onSubmit = async (data: UpdateModelInput) => {
    try {
      await updateModel.mutateAsync({ id: modelId, data });

      form.reset(data);
    } catch (error) {
      console.error(
        `Error updating model:`,
        error,
      );
    }
  };

  return (
    <Context.Provider value={{ form, model, onSubmit }}>
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
                    <span>Saving...</span>
                  </>
                )
                : (
                  <span>
                    Save {numberOfChanges}{" "}
                    change{numberOfChanges > 1 ? "s" : ""}
                  </span>
                )}
            </Button>
          </div>
        }
        breadcrumb={
          <DefaultBreadcrumb
            items={[
              { label: "Models" },
              { label: model.name },
            ]}
          />
        }
      />
    </Context.Provider>
  );
}
