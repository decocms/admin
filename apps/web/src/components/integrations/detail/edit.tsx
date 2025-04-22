import {
  type Integration,
  IntegrationSchema,
  useIntegration,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router";
import { ChatInput } from "../../chat/ChatInput.tsx";
import { ChatMessages } from "../../chat/ChatMessages.tsx";
import { ChatProvider } from "../../chat/context.tsx";
import { DockedPageLayout, DockedToggleButton } from "../../pageLayout.tsx";
import ThreadSettingsTab from "../../settings/chat.tsx";
import { Context } from "./context.ts";
import { DetailForm } from "./form.tsx";
import { Inspector } from "./inspector.tsx";

const MAIN = {
  header: Header,
  main: ChatMessages,
  footer: ChatInput,
};

const TABS = {
  inspector: {
    Component: Inspector,
    title: "Inspect",
    initialOpen: true,
  },
  form: {
    Component: DetailForm,
    title: "Configure",
    initialOpen: true,
  },
  tools: {
    Component: ThreadSettingsTab,
    title: "Tools",
  },
};

function Header() {
  return (
    <>
      <div>
        <Button asChild variant="ghost" onClick={() => {}}>
          <Link to="/integrations">
            <Icon name="arrow_back" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <DockedToggleButton
          id="form"
          title="Settings"
          variant="outline"
          size="icon"
        >
          <Icon name="settings" />
        </DockedToggleButton>
        <DockedToggleButton
          id="inspector"
          title="Inspector"
          variant="outline"
          size="icon"
        >
          <Icon name="frame_inspect" />
        </DockedToggleButton>
      </div>
    </>
  );
}

export default function Edit() {
  const { id } = useParams();
  const integrationId = id!;
  const { data: integration } = useIntegration(integrationId);

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
      agentId={WELL_KNOWN_AGENT_IDS.teamAgent}
      threadId={integrationId}
      initialMessage={{
        role: "user",
        content:
          `Please help me setting up a new integration. Enable integration with installation id of ${integrationId} and help me exploring its tools`,
      }}
    >
      <Context.Provider value={{ form, integration }}>
        <DockedPageLayout main={MAIN} tabs={TABS} />
      </Context.Provider>
    </ChatProvider>
  );
}
