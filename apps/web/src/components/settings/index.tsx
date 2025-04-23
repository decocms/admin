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
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { getDiffCount, Integration } from "./integrations/index.tsx";
import { useFocusChat } from "../agents/hooks.ts";
import { useNavigate } from "react-router";

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
  const previousChangesRef = useRef(0);
  const focusChat = useFocusChat();
  const navigate = useNavigate();
  const isDraft = agent?.draft;

  const form = useForm<Agent>({
    resolver: zodResolver(AgentSchema),
    defaultValues: agent,
  });

  const toolsSet = form.watch("tools_set");

  const numberOfChanges = (() => {
    const { tools_set: _, ...rest } = form.formState.dirtyFields;

    return Object.keys(rest).length +
      getDiffCount(toolsSet, agent.tools_set);
  })();

  // Notify about changes when number of changes updates
  useEffect(() => {
    if (numberOfChanges !== previousChangesRef.current) {
      previousChangesRef.current = numberOfChanges;
      
      // Dispatch event with the number of changes
      const changeEvent = new CustomEvent('agent:changes-updated', {
        detail: { numberOfChanges }
      });
      globalThis.dispatchEvent(changeEvent);
    }
  }, [numberOfChanges]);

  useEffect(() => {
    if (agent) {
      form.reset(agent);
    }
  }, [agent, form]);

  // Listen for the discard event from the header
  useEffect(() => {
    const handleDiscardEvent = () => {
      if (agent) {
        form.reset(agent);
      }
    };

    globalThis.addEventListener('agent:discard-changes', handleDiscardEvent);
    
    return () => {
      globalThis.removeEventListener('agent:discard-changes', handleDiscardEvent);
    };
  }, [agent, form]);

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

  const onSubmit = async (data: Agent) => {
    await updateAgent.mutateAsync(data);

    if(isDraft) {
      focusChat(agentId, crypto.randomUUID());
    }else{
      navigate(-1);
    }
  };

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 px-4 py-2 pb-16"
      >
        {/* Avatar Section */}
        <div className="flex justify-center">
          <div className="h-40 w-40">
            <AgentAvatar
              name={agent.name}
              avatar={agent.avatar}
              className="rounded-lg"
            />
          </div>
        </div>

        <FormField
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter agent name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your agent's purpose"
                  className="min-h-36"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Used only for organization and search, it does not affect the
                agent's behaviour
              </FormDescription>
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
          name="max_tokens"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Tokens</FormLabel>
              <FormControl>
                <Input
                  type="number"
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
                .filter((i) => i.id !== agent.id)
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
    </Form>
  );
}

export default SettingsTab;
