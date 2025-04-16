import {
  useIntegrations,
  useThreadTools,
  useUpdateThreadTools,
} from "@deco/sdk";
import { Alert } from "@deco/ui/components/alert.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@deco/ui/components/form.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useChatContext } from "./context.tsx";
import { getDiffCount, ToolsetSelector } from "../toolset/ToolsetSelector.tsx";

const toolsFormSchema = z.object({
  tools: z.record(z.string(), z.array(z.string())),
});

type ToolsFormValues = z.infer<typeof toolsFormSchema>;

function ThreadTools() {
  const { agentId, threadId } = useChatContext();
  const { data: tools } = useThreadTools(agentId, threadId);
  const { data: integrations } = useIntegrations();
  const updateTools = useUpdateThreadTools(agentId, threadId);

  const form = useForm<ToolsFormValues>({
    resolver: zodResolver(toolsFormSchema),
    defaultValues: {
      tools: tools ?? {},
    },
  });

  const formTools = form.watch("tools");

  const diff = useMemo(
    () => getDiffCount(tools, formTools),
    [tools, formTools],
  );

  const onSubmit = (data: ToolsFormValues) => {
    updateTools.mutate(data.tools, {
      onSuccess: () => {
        form.reset(data);
      },
    });
  };

  const handleSetTools = (integrationId: string, toolSet?: string[]) => {
    const currentTools = form.getValues("tools");
    const nextTools = { ...currentTools };

    if (toolSet?.length) {
      nextTools[integrationId] = toolSet;
    } else {
      delete nextTools[integrationId];
    }

    form.setValue("tools", nextTools, { shouldDirty: true });
  };

  const handleCancel = () => {
    form.reset();
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 flex flex-col h-full"
      >
        {updateTools.isError && (
          <Alert variant="destructive" className="inline-flex">
            {updateTools.error instanceof Error
              ? `Error: ${updateTools.error.message}`
              : "An error occurred while saving the tools"}
          </Alert>
        )}
        <FormField
          control={form.control}
          name="tools"
          render={() => (
            <FormItem className="flex-1">
              <FormLabel className="text-lg font-medium">
                Integrations
              </FormLabel>
              <FormControl>
                <ToolsetSelector
                  integrations={integrations || []}
                  currentToolset={formTools}
                  setTools={handleSetTools}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="h-8" />

        <div
          className={cn(
            form.formState.isDirty ? "flex" : "hidden",
            "absolute bottom-0 left-0 right-0",
            "border-t bg-background",
            "gap-2 p-4",
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
            disabled={updateTools.isPending}
          >
            Discard
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={updateTools.isPending}
          >
            {updateTools.isPending
              ? (
                <div className="flex items-center">
                  <div className="mr-2">
                    <Spinner size="xs" />
                  </div>
                  <span>Saving...</span>
                </div>
              )
              : `Save ${diff} change${diff !== 1 ? `s` : ""}`}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default ThreadTools;
