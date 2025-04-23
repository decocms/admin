import {
  AgentNotFoundError,
  useAgent,
  useRemoveAgent,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useDuplicateAgent } from "../agents/list.tsx";
import { useFocusAgent } from "../agents/hooks.ts";
import { trackEvent } from "../../hooks/analytics.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useNavigate } from "react-router";

interface Props {
  agentId: string;
}

export function ChatHeader() {
  const { agentId } = useChatContext();

  if (agentId === WELL_KNOWN_AGENT_IDS.teamAgent) {
    return (
      <Container>
        <Icon name="forum" size={16} />
        <h1 className="text-sm font-medium tracking-tight">
          New chat
        </h1>
      </Container>
    );
  }

  return (
    <ErrorBoundary
      fallback={<ChatHeader.Fallback />}
      shouldCatch={(e) => e instanceof AgentNotFoundError}
    >
      <Suspense fallback={<ChatHeader.Skeleton />}>
        <ChatHeader.UI agentId={agentId} />
      </Suspense>
    </ErrorBoundary>
  );
}

ChatHeader.Fallback = () => {
  return (
    <Container>
      <Icon name="smart_toy" size={16} className="opacity-50" />
      <h1 className="text-sm font-medium tracking-tight opacity-50">
        This agent has been deleted
      </h1>
    </Container>
  );
};

ChatHeader.Skeleton = () => {
  return <div className="h-10 w-full" />;
};

ChatHeader.UI = ({ agentId }: Props) => {
  const { data: agent } = useAgent(agentId);
  const { duplicate, duplicating } = useDuplicateAgent(agent);
  const focusAgent = useFocusAgent();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const removeAgent = useRemoveAgent();
  const navigate = useNavigate();

  // Function to handle actual deletion
  const handleDelete = async () => {
    try {
      await removeAgent.mutateAsync(agent.id);
      setDeleteDialogOpen(false);

      trackEvent("agent_delete", {
        success: true,
        data: agent,
      });
      navigate("/agents");
    } catch (error) {
      console.error("Error deleting Agent:", error);

      trackEvent("agent_delete", {
        success: false,
        error,
      });
    }
  };

  return (
    <>
      <Container>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] overflow-hidden flex items-center justify-center">
            <AgentAvatar
              name={agent.name}
              avatar={agent.avatar}
              className="rounded-lg text-xs"
            />
          </div>
          <h1 className="text-sm font-medium tracking-tight">
            {agent.name}
          </h1>
        </div>

        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                className=" transition-opacity"
              >
                <Icon name="more_horiz" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                disabled={duplicating}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  focusAgent(agent.id);
                }}
              >
                <Icon name="settings" className="mr-2" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={duplicating}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  duplicate();
                }}
              >
                <Icon name="content_copy" className="mr-2" />
                {duplicating ? "Duplicating..." : "Duplicate"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialogOpen(true);
                }}
              >
                <Icon name="delete" className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Container>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => setDeleteDialogOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {agent.name}{" "}
              agent. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete();
              }}
              disabled={removeAgent.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removeAgent.isPending
                ? (
                  <>
                    <Spinner size="xs" />
                    <span className="ml-2">Deleting...</span>
                  </>
                )
                : (
                  "Delete"
                )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex w-full items-center justify-between text-slate-700 py-1 group">
      {children}
    </div>
  );
};
