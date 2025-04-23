import {
  AgentSchema,
  useIntegrations,
  useThreadTools,
  useUpdateThreadTools,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Form, FormDescription, FormLabel } from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useChatContext } from "../chat/context.tsx";
import { getDiffCount, Integration } from "../toolsets/index.tsx";

const ChatSchema = z.object({
  tools_set: AgentSchema.shape.tools_set,
});

type Chat = z.infer<typeof ChatSchema>;

function ThreadSettingsTab() {
  const { agentId, threadId } = useChatContext();
  const { data: tools } = useThreadTools(agentId, threadId);
  const { data: installedIntegrations } = useIntegrations();
  const updateTools = useUpdateThreadTools(agentId, threadId);
  const defaultValues = useMemo(() => ({ tools_set: tools }), [tools]);

  const form = useForm<Chat>({
    resolver: zodResolver(ChatSchema),
    defaultValues,
  });

  const toolsSet = form.watch("tools_set");

  const numberOfChanges = (() => {
    const { tools_set: _, ...rest } = form.formState.dirtyFields;

    return Object.keys(rest).length +
      getDiffCount(toolsSet, tools);
  })();

  const setIntegrationTools = (
    integrationId: string,
    tools: string[],
  ) => {
    const toolsSet = form.getValues("tools_set");
    const newToolsSet = { ...toolsSet };

    if (tools.length > 0) {
      newToolsSet[integrationId] = tools;
    } else {
      delete newToolsSet[integrationId];
    }

    form.setValue("tools_set", newToolsSet, { shouldDirty: true });
  };

  const onSubmit = async (data: Chat) => {
    await updateTools.mutateAsync(data.tools_set);
    form.reset(data);
  };

  return (
    <Form {...form}>
      <ScrollArea className="h-full w-full px-4 py-2 bg-gradient-to-b from-white to-slate-50 p-6 text-slate-700">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 px-4 py-2"
        >
          {/* Tools Section */}
          <div className="space-y-2">
            <FormLabel className="text-lg font-medium">
              Integrations
            </FormLabel>
            <FormDescription>
              Enable or disable integrations to customize your agent's
              capabilities
            </FormDescription>
            <div className="flex-1">
              <div className="flex flex-col gap-4">
                {installedIntegrations
                  .filter((i) => i.id !== agentId)
                  .map((integration) => (
                    <Integration
                      key={integration.id}
                      integration={integration}
                      setIntegrationTools={setIntegrationTools}
                      enabledTools={toolsSet[integration.id] || []}
                    />
                  ))}
              </div>
            </div>
          </div>

          <div className="h-12" />

          {numberOfChanges > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-background border-t p-4 flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  form.reset(defaultValues);
                }}
              >
                Discard
              </Button>
              <Button
                type="submit"
                className="flex-1 gap-2"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? (
                    <>
                      <Spinner size="sm" /> Saving...
                    </>
                  )
                  : `Save ${numberOfChanges} Change${
                    numberOfChanges === 1 ? "" : "s"
                  }`}
              </Button>
            </div>
          )}
        </form>
      </ScrollArea>
    </Form>
  );
}

export default ThreadSettingsTab;
