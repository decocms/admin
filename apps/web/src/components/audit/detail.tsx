import { useThread } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { format } from "date-fns";
import { useNavigate, useParams } from "react-router";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { AgentInfo, UserInfo } from "../common/TableCells.tsx";
import { Tab } from "../dock/index.tsx";
import { PageLayout } from "../layout.tsx";

const useThreadId = () => {
  const { id } = useParams();

  if (!id) {
    throw new Error("No id provided");
  }

  return id;
};

function Header() {
  const id = useThreadId();
  const navigate = useNavigate();
  const { data: { title } = {} } = useThread(id);

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
        <Icon name="arrow_back" />
      </Button>
      <Icon name="manage_search" />
      <span className="text-nowrap">Chat logs</span>
      <span className="text-sm text-slate-500">/</span>
      <span className="text-sm text-slate-500">{title}</span>
    </div>
  );
}

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

  return (
    <ChatProvider
      agentId={thread?.metadata?.agentId ?? id}
      threadId={id}
    >
      <PageLayout
        tabs={TABS}
        breadcrumb={<Header />}
        displayViewsTrigger={false}
      />
    </ChatProvider>
  );
}

export default Page;
