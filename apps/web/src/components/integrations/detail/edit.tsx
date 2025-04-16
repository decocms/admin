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
import { togglePanel } from "../../dock/index.tsx";
import { DockedPageLayout, DockedToggleButton } from "../../pageLayout.tsx";
import { Context } from "./context.ts";
import { Main } from "./form.tsx";
import Inspector from "./inspector.tsx";

const MAIN = {
  header: Header,
  main: ChatMessages,
  footer: ChatInput,
};

const TABS = {
  inspector: {
    Component: Inspector,
    initialOpen: true,
  },
  form: {
    Component: Main,
    initialOpen: true,
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
          title="Configure"
          variant="outline"
          size="icon"
        >
          <Icon name="build" />
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

const initialMessages = [{
  content: "",
  role: "user",
}];

export default function Edit() {
  const { id } = useParams();
  const { data: integration } = useIntegration(id!);

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
      agentId={WELL_KNOWN_AGENT_IDS.setupAgent}
      threadId={integration.id}
      initialMessages={[{
        id: "1",
        role: "user",
        content:
          `Hello, I need help setting up my integration with installation id ${integration.id}. Please enable it and then list the available tools so we properly configure the integration.`,
      }]}
    >
      <Context.Provider value={{ form, integration }}>
        <DockedPageLayout main={MAIN} tabs={TABS} />
      </Context.Provider>
    </ChatProvider>
  );
}
