import { useThread } from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useParams } from "react-router";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";

const useThreadId = () => {
  const { id } = useParams();

  if (!id) {
    throw new Error("No id provided");
  }

  return id;
};

const TABS: Record<string, Tab> = {
  main: {
    title: "Audit",
    Component: () => (
      <ScrollArea className="h-full py-6">
        <ChatMessages />
      </ScrollArea>
    ),
    initialOpen: true,
  },
};

function Page() {
  const id = useThreadId();
  const { data: thread } = useThread(id);
  const { data: { title } = {} } = useThread(id);

  return (
    <ChatProvider
      agentId={thread?.metadata?.agentId ?? id}
      threadId={id}
    >
      <PageLayout
        tabs={TABS}
        breadcrumb={
          <DefaultBreadcrumb
            items={[
              { label: "Chat logs", link: "/audits" },
              ...(title ? [{ label: title, link: "" }] : []),
            ]}
          />
        }
        displayViewsTrigger={false}
      />
    </ChatProvider>
  );
}

export default Page;
