import {
  type Agent,
  AgentSchema,
  Integration,
  useAgent,
  useIntegrations,
  useUpdateAgent,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { createContext, Suspense, useContext, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import {
  getAgentOverrides,
  useAgentHasChanges,
  useAgentOverridesSetter,
  useOnAgentChangesDiscarded,
} from "../../hooks/useAgentOverrides.ts";
import { usePersistedDirtyForm } from "../../hooks/usePersistedDirtyForm.ts";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider, useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import AgentSettings from "../settings/agent.tsx";
import { AgentTriggers } from "../triggers/agentTriggers.tsx";
import { AgentBreadcrumbSegment } from "./BreadcrumbSegment.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";

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
    initialOpen: true,
  },
  setup: {
    Component: AgentSettings,
    title: "Setup",
    initialOpen: "within",
  },
  chat: {
    Component: Chat,
    title: "Chat preview",
    initialOpen: "right",
  },
};

// --- AgentSettingsFormContext ---
interface AgentSettingsFormContextValue {
  form: ReturnType<typeof useForm<Agent>>;
  hasChanges: boolean;
  discardCurrentChanges: () => void;
  onMutationSuccess: () => void;
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
// --- End AgentSettingsFormContext ---

export default function Page(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    return <div>Agent not found</div>;
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

  // Persisted dirty form logic
  const agentOverrides = useAgentOverridesSetter(agentId);

  const { hasChanges, discardCurrentChanges } = useAgentHasChanges(agentId);

  const { form, discardChanges, onMutationSuccess } = usePersistedDirtyForm<
    Agent
  >({
    resolver: zodResolver(AgentSchema),
    defaultValues: agent,
    persist: agentOverrides.update,
    getOverrides: () => getAgentOverrides(agentId),
  });

  useOnAgentChangesDiscarded(agentId, discardChanges);

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;
  const handleSubmit = form.handleSubmit((data: Agent) =>
    updateAgent.mutateAsync(data, { onSuccess: onMutationSuccess })
  );

  return (
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
        }}
      >
        <AgentSettingsFormContext.Provider
          value={{
            form,
            hasChanges,
            discardCurrentChanges,
            onMutationSuccess,
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
                  numberOfChanges > 0 ? "opacity-100" : "opacity-0",
                )}
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={form.formState.isSubmitting}
                  onClick={discardCurrentChanges}
                >
                  Discard
                </Button>
                <Button
                  variant="special"
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
  );
}
