import {
  type Integration,
  IntegrationSchema,
  useIntegration,
  useUpdateIntegration,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { ChatInput } from "../../chat/ChatInput.tsx";
import { ChatMessages } from "../../chat/ChatMessages.tsx";
import { ChatProvider } from "../../chat/context.tsx";
import { Tab } from "../../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../../layout.tsx";
import ThreadSettingsTab from "../../settings/chat.tsx";
import { Context } from "./context.ts";
import { DetailForm } from "./form.tsx";
import { Inspector } from "./inspector.tsx";

function MainChat() {
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="p-2">
        <ChatInput />
      </div>
    </div>
  );
}

const TABS: Record<string, Tab> = {
  main: {
    Component: MainChat,
    title: "Chat setup",
    initialOpen: true,
  },
  inspector: {
    Component: Inspector,
    title: "Test integration",
    initialOpen: true,
  },
  form: {
    Component: DetailForm,
    title: "Setup",
    initialOpen: true,
  },
  tools: {
    Component: ThreadSettingsTab,
    title: "Tools",
    hideFromViews: true,
  },
};

export default function Page() {
  const { id } = useParams();
  const integrationId = id!;
  const { data: integration } = useIntegration(integrationId);

  const agentId = WELL_KNOWN_AGENT_IDS.setupAgent;
  const threadId = integrationId;

  const form = useForm<Integration>({
    resolver: zodResolver(IntegrationSchema),
    defaultValues: {
      id: integration.id || crypto.randomUUID(),
      name: integration.name || "",
      description: integration.description || "",
      icon: integration.icon || "",
      connection: integration.connection || {
        type: "HTTP" as const,
        url: "https://example.com/sse",
        token: "",
      },
    },
  });

  const updateIntegration = useUpdateIntegration();
  const isMutating = updateIntegration.isPending;

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;

  const handleDiscard = () => form.reset(integration);

  return (
    <ChatProvider
      agentId={agentId}
      threadId={threadId}
      initialMessage={{
        role: "user",
        content:
          `Please help me set up this new integration. Enable integration with installation ID: ${integrationId} and help me explore its tools`,
      }}
    >
      <Context.Provider
        value={{ form, integration, updateIntegration }}
      >
        <PageLayout
          tabs={TABS}
          actionButtons={
            <div
              className={cn(
                "flex items-center gap-2",
                "transition-opacity",
                numberOfChanges > 0 ? "opacity-100" : "opacity-0",
              )}
            >
              <Button
                type="button"
                variant="outline"
                className="text-slate-700"
                onClick={handleDiscard}
              >
                Discard
              </Button>
              <Button
                className="bg-primary-light text-primary-dark hover:bg-primary-light/90 gap-2"
                disabled={!numberOfChanges}
              >
                {isMutating
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
                { label: "Integrations", link: "/integrations" },
                ...(integration?.name ? [{ label: integration.name }] : []),
              ]}
            />
          }
        />
      </Context.Provider>
    </ChatProvider>
  );
}
