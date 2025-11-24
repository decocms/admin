import { type Thread, useThreads } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";
import { useUser } from "../../hooks/use-user.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { DateTimeCell, UserInfo } from "../common/table/table-cells.tsx";

function Item({
  agentId,
  thread,
  showUser,
}: {
  agentId: string;
  thread: Thread;
  showUser?: boolean;
}) {
  const user = useUser();
  const focusChat = useFocusChat();
  return (
    <button
      className={cn(
        "w-full text-left",
        "px-3 py-2",
        "hover:bg-muted/60",
        "cursor-pointer",
        showUser
          ? "grid grid-cols-[auto_1fr_auto] items-center gap-3"
          : "grid grid-cols-[1fr_auto] items-center gap-3",
      )}
      type="button"
      onClick={() =>
        focusChat(agentId, thread.id.replace(`${user?.id ?? ""}-`, ""))
      }
    >
      {showUser && (
        <div className="shrink-0 min-w-[160px]">
          <UserInfo userId={thread.resourceId} noTooltip />
        </div>
      )}
      <div className="min-w-0">
        <span
          className="truncate block text-sm leading-snug"
          title={thread.title}
        >
          {thread.title}
        </span>
      </div>
      <div className="justify-self-end text-muted-foreground text-xs leading-tight">
        <DateTimeCell value={thread.updatedAt || thread.createdAt} />
      </div>
    </button>
  );
}

function Section({
  title,
  threads,
  showUser,
  agentId,
  emptyText,
}: {
  title: string;
  threads: Thread[];
  showUser?: boolean;
  agentId: string;
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold px-2">{title}</h3>
      {threads.length === 0 ? (
        <div className="text-xs text-muted-foreground px-2">{emptyText}</div>
      ) : (
        <div className="border border-border rounded-[12px] overflow-hidden">
          {threads.map((t, idx) => (
            <div
              key={t.id}
              className={cn(
                "border-border",
                idx !== threads.length - 1 && "border-b",
              )}
            >
              <Item agentId={agentId} thread={t} showUser={showUser} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadsList({ agentId }: { agentId: string }) {
  const user = useUser();
  const my = useThreads({ agentId, resourceId: user?.id ?? "" });
  const all = useThreads({ agentId });

  const myThreads = (my.data.threads ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );
  const otherThreads = (all.data.threads ?? [])
    .slice()
    .filter((t) => t.resourceId !== (user?.id ?? ""))
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );

  const showProjectThreads = Boolean(
    import.meta.env.VITE_FEATURE_THREADS_PROJECT,
  );

  const nothing =
    myThreads.length === 0 &&
    (!showProjectThreads || otherThreads.length === 0);

  return (
    <div
      className={cn(
        "text-foreground w-full max-w-3xl mx-auto space-y-6 inline-block",
      )}
    >
      {nothing ? (
        <div className="text-center py-12">
          <h2 className="text-lg font-medium text-foreground mb-2">
            No conversations yet
          </h2>
          <p className="text-sm text-muted-foreground">
            Start a new conversation to begin chatting with this agent.
          </p>
        </div>
      ) : (
        <>
          <Section
            title="My threads"
            threads={myThreads}
            agentId={agentId}
            emptyText="You haven't started any conversations yet."
          />
          {showProjectThreads ? (
            <Section
              title="Project threads"
              threads={otherThreads}
              showUser
              agentId={agentId}
              emptyText="No conversations from other collaborators yet."
            />
          ) : null}
        </>
      )}
    </div>
  );
}

export default ThreadsList;
