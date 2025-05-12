import {
  type Integration,
  IntegrationSchema,
  useIntegration,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
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
      <div className="pb-4">
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

export default function Edit() {
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

  return (
    <ChatProvider
      agentId={agentId}
      threadId={threadId}
      initialMessage={{
        role: "user",
        content:
          `Please help me setting up a new integration. Enable integration with installation id of ${integrationId} and help me exploring its tools`,
      }}
    >
      <Context.Provider value={{ form, integration }}>
        <PageLayout
          tabs={TABS}
          breadcrumb={
            <DefaultBreadcrumb
              icon="widgets"
              list="Integrations"
              item={integration?.name}
            />
          }
        />
      </Context.Provider>
    </ChatProvider>
  );
}
