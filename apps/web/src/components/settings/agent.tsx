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
import { useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { Integration } from "../toolsets/index.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  getAgentOverrides,
  useAgentHasChanges,
  useAgentOverridesSetter,
  useOnAgentChangesDiscarded,
} from "../../hooks/useAgentOverrides.ts";
import { usePersistedDirtyForm } from "../../hooks/usePersistedDirtyForm.ts";
import { ControllerRenderProps, FieldValues } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";

function SystemPromptTextarea({
  field,
}: {
  field: ControllerRenderProps<FieldValues, "instructions">;
}) {
  return (
    <FormItem>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <FormLabel>System Prompt</FormLabel>
          <FormDescription>
            Guide your agent's behavior with custom instructions.
          </FormDescription>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Expand prompt"
        >
              <Icon name="expand_content" size={16} />
            </Button>
          </DialogTrigger>

          <DialogContent className="h-[85vh]">
            <DialogHeader>
              <DialogTitle>System Prompt</DialogTitle>
              <DialogDescription>
                Guide your agent's behavior with custom instructions.
              </DialogDescription>
              <Textarea
                placeholder="Enter the agent's system prompt"
                className="h-full mt-1"
                {...field}
              />
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
      <FormControl>
        <Textarea
          placeholder="Enter the agent's system prompt"
          className="min-h-36 mt-1"
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}

function SaveChangesSnackbar() {
  const { agentId } = useChatContext();
  const { hasChanges, discardCurrentChanges } = useAgentHasChanges(agentId);
  const updateAgent = useUpdateAgent();
  const isLoading = updateAgent.isPending;

  const handleUpdate = () => {
    try {
      const form = document.getElementById(
        "agent-settings-form",
      ) as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    } catch (error) {
      console.error("Error updating agent:", error);
    }
  };

  return (
    <div 
      className={`fixed w-[500px] bottom-4 left-1/2 -translate-x-1/2 flex gap-2 justify-between items-center bg-white rounded-full border border-slate-200 p-2 shadow-md transition-transform duration-300 ease-in-out ${
        !hasChanges && !isLoading ? 'translate-y-[200%]' : 'translate-y-0'
      }`}
    >
      <p className="pl-2">You have unsaved changes</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="w-24" onClick={discardCurrentChanges}>
          Discard
        </Button>
        <Button
          className="bg-primary-light text-primary-dark hover:bg-primary-light/90 flex items-center justify-center w-24 gap-2"
          onClick={handleUpdate}
          disabled={isLoading}
        >
          {isLoading ? <Spinner size="xs" /> : <span>Save</span>}
        </Button>
      </div>
    </div>
  );
}

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
    await updateAgent.mutateAsync(data, {
      onSuccess: onMutationSuccess,
    });
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
      <div className="h-full overflow-y-auto w-full text-slate-700 md:p-4 md:px-16 relative">
        <SaveChangesSnackbar />
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 py-8 pb-16"
        >
          <div className="flex gap-4 items-end">
            <div className="flex-shrink-0 h-18 w-18">
              <AgentAvatar
                name={agent.name}
                avatar={agent.avatar}
                className="rounded-lg"
              />
            </div>

            <div className="w-full">
              <FormField
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        className="rounded-md"
                        placeholder="Enter agent name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            name="instructions"
            render={({ field }) => <SystemPromptTextarea field={field} />}
          />

          <FormField
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About this agent</FormLabel>
                <FormDescription>
                  Used for organization and search; does not affect behavior.
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
              Tools
            </FormLabel>
            <FormDescription>
              Integrations that expand the agent's abilities.
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
        </form>
      </div>
    </Form>
  );
}

export default SettingsTab;
