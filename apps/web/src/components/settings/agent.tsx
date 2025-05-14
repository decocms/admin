import {
  type Agent,
  AgentSchema,
  useAgent,
  useIntegrations,
  useUpdateAgent,
} from "@deco/sdk";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  getAgentOverrides,
  useAgentHasChanges,
  useAgentOverridesSetter,
  useOnAgentChangesDiscarded,
} from "../../hooks/useAgentOverrides.ts";
import { usePersistedDirtyForm } from "../../hooks/usePersistedDirtyForm.ts";
import { useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { FormSubmitControls } from "../common/FormSubmit.tsx";
import { Integration } from "../toolsets/index.tsx";
import { ModelSelector } from "../chat/ModelSelector.tsx";

// Token limits for Anthropic models
const ANTHROPIC_MIN_MAX_TOKENS = 4096;
const ANTHROPIC_MAX_MAX_TOKENS = 64000;

interface SettingsTabProps {
  formId?: string;
}

function SettingsTab({ formId }: SettingsTabProps) {
  const { agentId } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const { data: installedIntegrations } = useIntegrations();
  const updateAgent = useUpdateAgent();

  const [isLoading, setIsLoading] = useState(false);
  const { hasChanges, discardCurrentChanges } = useAgentHasChanges(agentId);

  const agentOverrides = useAgentOverridesSetter(agentId);

  const { form, discardChanges, onMutationSuccess } = usePersistedDirtyForm<
    Agent
  >({
    resolver: zodResolver(AgentSchema),
    defaultValues: agent,
    persist: agentOverrides.update,
    getOverrides: () => getAgentOverrides(agentId),
  });

  useOnAgentChangesDiscarded(agentId, discardChanges);

  const onSubmit = async (data: Agent) => {
    setIsLoading(true);
    try {
      await updateAgent.mutateAsync(data, {
        onSuccess: onMutationSuccess,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toolsSet = form.watch("tools_set");
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

  return (
    <Form {...form}>
      <div className="h-full overflow-y-auto w-full p-4 max-w-3xl mx-auto">
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 py-2 pb-16"
        >
          <FormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-6">
                  <div className="h-16 w-16">
                    <AgentAvatar
                      name={agent.name}
                      avatar={agent.avatar}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        className="rounded-md"
                        placeholder="Enter agent name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </div>
                </div>
              </FormItem>
            )}
          />

          <FormField
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Model</FormLabel>
                <FormControl>
                  <ModelSelector
                    model={field.value}
                    onModelChange={(newValue) => field.onChange(newValue)}
                    variant="bordered"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="instructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>System Prompt</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter the agent's system prompt"
                    className="min-h-36"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About this agent</FormLabel>
                <FormDescription>
                  Used only for organization and search, it does not affect the
                  agent's behaviour
                </FormDescription>
                <FormControl>
                  <Textarea
                    placeholder="Describe your agent's purpose"
                    className="min-h-18"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="max_tokens"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Tokens</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="rounded-md"
                    min={ANTHROPIC_MIN_MAX_TOKENS}
                    max={ANTHROPIC_MAX_MAX_TOKENS}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tools Section */}
          <div className="space-y-2 mb-8">
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
                  .filter((i) => !i.id.includes(agentId))
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

          <FormSubmitControls
            numberOfChanges={hasChanges ? 1 : 0}
            submitting={isLoading}
            onDiscard={discardCurrentChanges}
          />
        </form>
      </div>
    </Form>
  );
}

export default SettingsTab;
