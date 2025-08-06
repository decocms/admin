import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, createContext, useContext } from "react";
import { useBlocker } from "react-router";
import { toast } from "sonner";

import {
  type Agent,
  type Integration,
  useAgent,
  useIntegrations,
  useUpdateAgent,
  useUpdateAgentCache,
  AgentSchema,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { useCreateAgent } from "../../hooks/use-create-agent.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";

interface AgentSettingsFormContextValue {
  form: UseFormReturn<Agent>;
  hasChanges: boolean;
  handleSubmit: () => void;
  installedIntegrations: Integration[];
  agent: Agent;
}

const AgentSettingsFormContext = createContext<
  AgentSettingsFormContextValue | undefined
>(undefined);

export function useAgentSettingsForm() {
  const ctx = useContext(AgentSettingsFormContext);
  if (!ctx) {
    throw new Error(
      "useAgentSettingsForm must be used within AgentSettingsFormContext",
    );
  }
  return ctx;
}

interface AgentSettingsFormProviderProps {
  agentId: string;
  children: React.ReactNode;
  onFormReady?: (form: UseFormReturn<Agent>) => void;
}

export function AgentSettingsFormProvider({
  agentId,
  children,
  onFormReady,
}: AgentSettingsFormProviderProps) {
  const { data: agent } = useAgent(agentId);
  const { data: installedIntegrations } = useIntegrations();
  const updateAgent = useUpdateAgent();
  const updateAgentCache = useUpdateAgentCache();
  const createAgent = useCreateAgent();

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS],
  );

  const form = useForm({
    defaultValues: agent,
    resolver: zodResolver(AgentSchema),
  });

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;
  const hasChanges = numberOfChanges > 0;

  // Use deferred values for better UX - updates cache at lower priority
  const values = form.watch();
  useEffect(() => {
    const timeout = setTimeout(() => updateAgentCache(values as Agent), 200);

    return () => clearTimeout(timeout);
  }, [values, updateAgentCache]);

  const blocked = useBlocker(hasChanges && !isWellKnownAgent);

  const handleSubmit = form.handleSubmit(async (data: Agent) => {
    try {
      if (isWellKnownAgent) {
        const id = crypto.randomUUID();
        const agent = { ...data, id };
        await createAgent(agent, { eventName: "agent_create_from_well_known" });
        const wellKnownAgent =
          WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS];
        form.reset(wellKnownAgent);
        updateAgentCache(wellKnownAgent);
        return;
      }

      await updateAgent.mutateAsync(data);
      form.reset(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update agent",
      );
    }
  });

  function handleCancel() {
    blocked.reset?.();
  }

  function discardChanges() {
    form.reset();
    updateAgentCache(form.getValues() as Agent);
    blocked.proceed?.();
  }

  // Call onFormReady callback when form is ready
  useEffect(() => {
    if (onFormReady && agent) {
      onFormReady(form);
    }
  }, [onFormReady, form, agent]);

  return (
    <>
      <AlertDialog open={blocked.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave this page, your edits will
              be lost. Are you sure you want to discard your changes and
              navigate away?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={discardChanges}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgentSettingsFormContext.Provider
        value={{
          form: form as UseFormReturn<Agent>,
          hasChanges: hasChanges,
          handleSubmit,
          installedIntegrations:
            installedIntegrations?.filter((i) => !i.id.includes(agentId)) || [],
          agent: agent!,
        }}
      >
        {children}
      </AgentSettingsFormContext.Provider>
    </>
  );
}
