import {
  type Integration,
  IntegrationSchema,
  useIntegration,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { useNavigateWorkspace } from "../../../hooks/useNavigateWorkspace.ts";
import { ChatInput } from "../../chat/ChatInput.tsx";
import { ChatMessages } from "../../chat/ChatMessages.tsx";
import { ChatProvider } from "../../chat/context.tsx";
import { PageLayout } from "../../layout.tsx";
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

const TABS = {
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
  },
};

export default function Edit() {
  const { id } = useParams();
  const integrationId = id!;
  const { data: integration } = useIntegration(integrationId);
  const navigateWorkspace = useNavigateWorkspace();

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
            <Button
              variant="ghost"
              onClick={() => navigateWorkspace("/integrations")}
            >
              <Icon name="arrow_back" />
              Back
            </Button>
          }
        />
      </Context.Provider>
    </ChatProvider>
  );
}
