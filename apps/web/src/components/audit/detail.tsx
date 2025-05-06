import { useThreadMessages } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { format } from "date-fns";
import { useParams } from "react-router";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { DockedPageLayout } from "../pageLayout.tsx";
import { AgentInfo, UserInfo } from "../common/TableCells.tsx";

const MAIN = {
  header: Header,
  main: ChatMessages,
};

const useThreadId = () => {
  const { id } = useParams();

  if (!id) {
    throw new Error("No id provided");
  }

  return id;
};

function Header() {
  const id = useThreadId();
  const {
    data: {
      createdAt,
      updatedAt,
      resourceId,
      metadata: { agentId } = {},
    } = {},
  } = useThreadMessages(id);

  return (
    <div className="flex justify-between items-center gap-2 w-full">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => globalThis.history.back()}>
          <Icon name="arrow_back" />
          Back
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 md:gap-6 items-center">
        {/* Agent info */}
        <AgentInfo agentId={agentId} />
        {/* User info */}
        <UserInfo userId={resourceId} showDetails />
        {/* Created at */}
        <div className="flex-col gap-1 min-w-[150px] hidden md:flex">
          <div className="flex items-center gap-2 text-left leading-tight">
            <span className="text-xs text-muted-foreground font-medium mr-1">
              Created at
            </span>
            <span className="text-xs font-medium text-slate-800">
              {createdAt ? format(new Date(createdAt), "MMM dd, yyyy") : "-"}
            </span>
            <span className="text-xs font-normal text-slate-500">
              {createdAt ? format(new Date(createdAt), "HH:mm:ss") : "-"}
            </span>
          </div>
        </div>
        {/* Last updated */}
        <div className="flex-col gap-1 min-w-[150px] hidden md:flex">
          <div className="flex items-center gap-2 text-left leading-tight">
            <span className="text-xs text-muted-foreground font-medium mr-1">
              Last updated
            </span>
            <span className="text-xs font-medium text-slate-800">
              {updatedAt ? format(new Date(updatedAt), "MMM dd, yyyy") : "-"}
            </span>
            <span className="text-xs font-normal text-slate-500">
              {updatedAt ? format(new Date(updatedAt), "HH:mm:ss") : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditDetail() {
  const id = useThreadId();
  const { data: thread } = useThreadMessages(id);

  return (
    <ChatProvider
      agentId={thread?.metadata?.agentId ?? id}
      threadId={id}
      uiOptions={{ showEditAgent: false }}
    >
      <DockedPageLayout main={MAIN} tabs={{}} />
    </ChatProvider>
  );
}

export default AuditDetail;
