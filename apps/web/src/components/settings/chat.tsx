import {
  AgentSchema,
  useAgent,
  useIntegrations,
  useUpdateAgentCache,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Form, FormDescription, FormLabel } from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useTools } from "../../hooks/useTools.ts";
import { useChatContext } from "../chat/context.tsx";
import { Integration } from "../toolsets/index.tsx";
import { ToolsetSelector } from "../toolsets/selector.tsx";

const ChatSchema = z.object({
  tools_set: AgentSchema.shape.tools_set,
});

type Chat = z.infer<typeof ChatSchema>;

function ThreadSettingsTab() {
  const { agentId } = useChatContext();
  const tools_set = useTools(agentId);
  const { data: installedIntegrations } = useIntegrations();
  const { data: agent } = useAgent(agentId);
  const updateAgentCache = useUpdateAgentCache();
  const defaultValues = useMemo(() => ({ tools_set }), [tools_set]);

  const form = useForm<Chat>({
    resolver: zodResolver(ChatSchema),
    defaultValues,
  });

  const toolsSet = form.watch("tools_set");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(null);

  const usedIntegrations = installedIntegrations
    ? installedIntegrations.filter((integration) =>
      !!toolsSet[integration.id]?.length
    )
    : [];

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
    updateAgentCache({ ...agent, tools_set: newToolsSet });
  };

  const handleIntegrationClick = (
    integration: typeof installedIntegrations[number],
  ) => {
    setSelectedIntegrationId(integration.id);
    setIsModalOpen(true);
  };

  const onSubmit = (data: Chat) => {
    form.reset(data);
  };

  return (
    <ScrollArea className="h-full w-full p-2 text-slate-700">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 px-4 py-2"
        >
          <div className="space-y-2 mb-8">
            <div className="flex items-center justify-between space-y-1">
              <div className="flex flex-col gap-2">
                <FormLabel>Tools</FormLabel>
                <FormDescription className="text-xs text-slate-400">
                  Extensions that expand the agent's abilities.
                </FormDescription>
              </div>
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 bg-slate-700 hover:bg-slate-600 rounded-lg"
                onClick={() => {
                  setSelectedIntegrationId(null);
                  setIsModalOpen(true);
                }}
                aria-label="Add tools"
              >
                <span className="sr-only">Add tools</span>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M12 5v14m7-7H5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            </div>
            <div className="flex-1">
              <div className="flex flex-col gap-2">
                {usedIntegrations.map((integration) => (
                  <Integration
                    key={integration.id}
                    integration={integration}
                    setIntegrationTools={setIntegrationTools}
                    enabledTools={toolsSet[integration.id] || []}
                    onIntegrationClick={handleIntegrationClick}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="h-12" />
        </form>
        <ToolsetSelector
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) {
              setSelectedIntegrationId(null);
            }
          }}
          installedIntegrations={installedIntegrations?.filter((i) =>
            i.id !== agentId
          ) || []}
          toolsSet={toolsSet}
          setIntegrationTools={setIntegrationTools}
          initialSelectedIntegration={selectedIntegrationId}
        />
      </Form>
    </ScrollArea>
  );
}

export default ThreadSettingsTab;
