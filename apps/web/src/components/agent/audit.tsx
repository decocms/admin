import { AuditListContent } from "../audit/list.tsx";
import { useChatContext } from "../chat/context.tsx";

function Audit() {
  const { agentId } = useChatContext();

  return (
    <AuditListContent
      filters={{ agentId }}
      showFilters={false}
      columnsDenyList={new Set(["agent"])}
    />
  );
}

export default Audit;
