import {
  AgentSchema,
  DEFAULT_REASONING_MODEL,
  useAgent,
  useIntegrations,
  useUpdateAgent,
} from "@deco/sdk";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AgentAvatar } from "../common/Avatar.tsx";
import { getDiffCount, ToolsetSelector } from "../toolset/ToolsetSelector.tsx";
import { useSettings } from "./context.tsx";

// Token limits for Anthropic models
const ANTHROPIC_DEFAULT_MAX_TOKENS = 8192;
const ANTHROPIC_MIN_MAX_TOKENS = 4096;
const ANTHROPIC_MAX_MAX_TOKENS = 64000;

const DEFAULT_AGENT_SETTINGS: AgentFormValues = {
  id: "",
  name: "",
  avatar: "",
  instructions: "",
  description: "",
  tools_set: {},
  max_steps: 7,
  max_tokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
  model: DEFAULT_REASONING_MODEL,
  memory: { last_messages: 3 },
  views: [],
};

type AgentFormValues = z.infer<typeof AgentSchema>;

function App() {
  const { agentId } = useSettings();
  const { data: agent } = useAgent(agentId);
  const { data: installedIntegrations } = useIntegrations();
  const updateAgent = useUpdateAgent();
  const defaultValues = useMemo(
    () => ({ ...DEFAULT_AGENT_SETTINGS, ...agent, id: agentId }),
    [agent, agentId],
  );

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(AgentSchema),
    defaultValues,
  });

  const tools_set = form.watch("tools_set");

  const numberOfChanges = (() => {
    const { tools_set: _, ...rest } = form.formState.dirtyFields;

    return Object.keys(rest).length +
      getDiffCount(tools_set, defaultValues.tools_set);
  })();

  const onSubmit = (data: AgentFormValues) => {
    updateAgent.mutate(data, {
      onSuccess: () => {
        form.reset(data);
      },
    });
  };

  const handleSetTools = (integrationId: string, toolSet?: string[]) => {
    const tools = form.getValues("tools_set");

    if (toolSet?.length) {
      tools[integrationId] = toolSet;
    } else {
      delete tools[integrationId];
    }

    form.setValue("tools_set", tools, { shouldDirty: true, shouldTouch: true });
  };

  const handleCancel = () => {
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-1">
        {updateAgent.isError && (
          <Alert variant="destructive">
            <Icon name="error" className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {updateAgent.error.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-center w-full">
          <div className="w-24 h-24">
            <AgentAvatar
              name={form.getValues("name")}
              avatar={form.getValues("avatar")}
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
                <Input
                  {...field}
                  placeholder="Enter agent name"
                  className="rounded-lg border-input focus:none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:outline-none"
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
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  className="rounded-lg border-input focus:none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:outline-none min-h-36"
                  placeholder="Describe your agent's purpose"
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
                  {...field}
                  className="rounded-lg border-input focus:none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:outline-none min-h-36"
                  placeholder="Enter the agent's system prompt"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="tools_set"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Integrations
              </FormLabel>

              <ToolsetSelector
                integrations={installedIntegrations || []}
                currentToolset={field.value}
                setTools={handleSetTools}
              />
            </FormItem>
          )}
        />

        <FormField
          name="memory.last_messages"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Last Messages</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    field.onChange(Number(e.target.value))}
                  min={1}
                  max={100}
                />
              </FormControl>
              <FormDescription>
                Number of last messages to keep in memory (between 1 and 100)
              </FormDescription>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />

        <FormField
          name="max_tokens"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Max Tokens</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    field.onChange(Number(e.target.value))}
                  min={ANTHROPIC_MIN_MAX_TOKENS}
                  max={ANTHROPIC_MAX_MAX_TOKENS}
                />
              </FormControl>
              <FormDescription>
                Maximum number of tokens to generate (between{" "}
                {ANTHROPIC_MIN_MAX_TOKENS} and {ANTHROPIC_MAX_MAX_TOKENS})
              </FormDescription>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />

        <FormField
          name="max_steps"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Max Steps</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    field.onChange(Number(e.target.value))}
                  min={1}
                  max={20}
                />
              </FormControl>
              <FormDescription>
                Maximum number of steps the agent can take (between 1 and 20)
              </FormDescription>
              <FormMessage>{fieldState.error?.message}</FormMessage>
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
            disabled={updateAgent.isPending}
          >
            Discard
          </Button>

          <Button
            type="submit"
            disabled={updateAgent.isPending}
            className="flex-1"
          >
            {updateAgent.isPending
              ? (
                <>
                  <Spinner size="sm" />
                  Saving...
                </>
              )
              : `Save ${numberOfChanges} change${
                numberOfChanges === 1 ? "" : "s"
              }`}
          </Button>
        </div>
      </form>
    </Form>
  );
}

App.displayName = "Settings";

export default App;
