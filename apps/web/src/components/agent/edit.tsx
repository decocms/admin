import {
  type Agent,
  AgentSchema,
  Integration,
  NotFoundError,
  useAgent,
  useCreateAgent,
  useIntegrations,
  useUpdateAgent,
  useUpdateAgentCache,
  useUpdateThreadMessages,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
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
import { Button } from "@deco/ui/components/button.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { createContext, Suspense, useContext, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useBlocker, useParams } from "react-router";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider, useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import AgentSettings from "../settings/agent.tsx";
import { AgentTriggers } from "../triggers/agentTriggers.tsx";
import Audit from "./audit.tsx";
import { AgentBreadcrumbSegment } from "./BreadcrumbSegment.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";
import PromptTab from "../settings/prompt.tsx";
import IntegrationsTab from "../settings/integrations.tsx";
import { useEditAgent } from "../agents/hooks.ts";
import { trackEvent } from "../../hooks/analytics.ts";

interface Props {
  agentId?: string;
  threadId?: string;
}

const Chat = () => {
  const { agentId, chat } = useChatContext();
  const { data: agent } = useAgent(agentId);

  return (
    <div className="flex flex-col h-full min-w-[320px]">
      <div className="flex-none p-4">
        <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1">
          {chat.messages.length > 0 && (
            <>
              <div className="w-8 h-8 rounded-[10px] overflow-hidden flex items-center justify-center">
                <AgentAvatar
                  name={agent.name}
                  avatar={agent.avatar}
                  className="rounded-lg text-xs"
                />
              </div>
              <h1 className="text-sm font-medium tracking-tight">
                {agent.name}
              </h1>
            </>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="flex-none pb-4 px-4">
        <ChatInput />
      </div>
    </div>
  );
};

const TABS: Record<string, Tab> = {
  chatView: {
    Component: ThreadView,
    title: "Thread",
    hideFromViews: true,
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
    hideFromViews: true,
  },
  triggers: {
    Component: AgentTriggers,
    title: "Agent Triggers",
  },
  setup: {
    Component: AgentSettings,
    title: "Settings",
    initialOpen: "right",
    maximumWidth: 500,
  },
  integrations: {
    Component: IntegrationsTab,
    title: "Integrations",
    initialOpen: "within",
    maximumWidth: 500,
  },
  audit: {
    Component: Audit,
    title: "History",
    initialOpen: "left",
  },
  chat: {
    Component: Chat,
    title: "Chat",
    initialOpen: "within",
  },
  prompt: {
    Component: PromptTab,
    title: "System prompt",
    initialOpen: "below",
    maximumHeight: 270,
  },
};

// --- AgentSettingsFormContext ---
interface AgentSettingsFormContextValue {
  form: ReturnType<typeof useForm<Agent>>;
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

export default function Page(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    throw new NotFoundError("Agent not found");
  }

  const threadId = useMemo(
    () => props.threadId || params.threadId || agentId,
    [props.threadId, params.threadId, agentId],
  );

  const chatKey = useMemo(
    () => `${agentId}-${threadId}`,
    [agentId, threadId],
  );

  const { data: agent } = useAgent(agentId);
  const { data: installedIntegrations } = useIntegrations();
  const updateAgent = useUpdateAgent();
  const updateAgentCache = useUpdateAgentCache();
  const createAgent = useCreateAgent();
  const updateThreadMessages = useUpdateThreadMessages();
  const focusEditAgent = useEditAgent();

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS],
  );

  const form = useForm<Agent>({
    defaultValues: agent,
    resolver: zodResolver(AgentSchema),
  });

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;
  const hasChanges = numberOfChanges > 0;

  // Use deferred values for better UX - updates cache at lower priority
  const values = form.watch();
  useEffect(() => {
    const timeout = setTimeout(() => updateAgentCache(values), 200);

    return () => clearTimeout(timeout);
  }, [values, updateAgentCache]);

  const blocked = useBlocker(hasChanges && !isWellKnownAgent);

  const handleSubmit = form.handleSubmit(
    async (data: Agent) => {
      if (isWellKnownAgent) {
        const id = crypto.randomUUID();
        const agent = {
          ...data,
          id,
        };
        createAgent.mutateAsync(agent);
        blocked.proceed?.();
        updateThreadMessages(id);
        focusEditAgent(id, crypto.randomUUID(), { history: false });
        form.reset(agent);

        trackEvent("agent_create", {
          success: true,
          data: agent,
        });
        return;
      }

      try {
        await updateAgent.mutateAsync(data);
        form.reset(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update agent",
        );
      }
    },
  );

  function handleCancel() {
    blocked.reset?.();
  }

  function discardChanges() {
    form.reset();
    updateAgentCache(form.getValues());
    blocked.proceed?.();
  }

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
      <Suspense
        key={chatKey}
        fallback={
          <div className="h-full w-full flex items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <ChatProvider
          agentId={agentId}
          threadId={threadId}
          uiOptions={{
            showThreadTools: false,
            showEditAgent: false,
            showModelSelector: false,
          }}
        >
          <AgentSettingsFormContext.Provider
            value={{
              form,
              hasChanges: hasChanges,
              handleSubmit,
              installedIntegrations: installedIntegrations.filter(
                (i) => !i.id.includes(agentId),
              ),
              agent,
            }}
          >
            <PageLayout
              tabs={TABS}
              key={agentId}
              actionButtons={
                <div
                  className={cn(
                    "flex items-center gap-2 bg-slate-50",
                    "transition-opacity",
                    hasChanges ? "opacity-100" : "opacity-0",
                  )}
                >
                  <Button
                    type="button"
                    variant="outline"
                    disabled={form.formState.isSubmitting}
                    onClick={discardChanges}
                  >
                    Discard
                  </Button>
                  <Button
                    variant={isWellKnownAgent ? "default" : "special"}
                    onClick={handleSubmit}
                    disabled={!numberOfChanges ||
                      form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting
                      ? (
                        <>
                          <Spinner size="xs" />
                          <span>Saving...</span>
                        </>
                      )
                      : (
                        <span>
                          {isWellKnownAgent
                            ? "Save as Agent"
                            : `Save ${numberOfChanges} change${
                              numberOfChanges > 1 ? "s" : ""
                            }`}
                        </span>
                      )}
                  </Button>
                </div>
              }
              breadcrumb={
                <DefaultBreadcrumb
                  items={[
                    { link: "/agents", label: "Agents" },
                    {
                      label: (
                        <AgentBreadcrumbSegment
                          agentId={agentId}
                          variant="summary"
                        />
                      ),
                    },
                  ]}
                />
              }
            />
          </AgentSettingsFormContext.Provider>
        </ChatProvider>
      </Suspense>
    </>
  );
}
