import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { Avatar, AvatarFallback } from "@deco/ui/components/avatar.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useAcceptInvite, useInvites, useRejectInvite } from "@deco/sdk";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function InviteItem({
  invite,
  onAccept,
  onReject,
  loading,
}: {
  invite: {
    id: string;
    teamId: number;
    teamName: string;
    inviter: { name: string | null; email: string | null };
  };
  onAccept: () => void;
  onReject: () => void;
  loading: "accept" | "reject" | null;
}) {
  const getInitial = (name: string | null) =>
    name?.charAt(0).toUpperCase() || "T";

  return (
    <div className="group flex items-center gap-3 px-1 py-2 hover:bg-muted/50 rounded-lg transition-colors">
      <Avatar className="size-5 rounded-md">
        <AvatarFallback className="bg-primary-dark text-primary-light rounded-md text-xs">
          {getInitial(invite.teamName)}
        </AvatarFallback>
      </Avatar>
      <p className="flex-1 text-sm min-w-0">
        <span className="font-semibold">{invite.inviter.name}</span>
        {" invited you to join "}
        <span className="font-semibold">{invite.teamName}</span>
      </p>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          onClick={onReject}
          disabled={loading !== null}
          className="size-8 rounded-xl"
        >
          {loading === "reject" ? (
            <Spinner size="xs" />
          ) : (
            <Icon name="close" size={16} />
          )}
        </Button>
        <Button
          size="icon"
          variant="special"
          onClick={onAccept}
          disabled={loading !== null}
          className="size-8 rounded-xl"
        >
          {loading === "accept" ? (
            <Spinner size="xs" />
          ) : (
            <Icon name="check" size={16} />
          )}
        </Button>
      </div>
    </div>
  );
}

export function InboxPopover() {
  const [open, setOpen] = useState(false);
  const { data: invites = [] } = useInvites();
  const acceptInviteMutation = useAcceptInvite();
  const rejectInviteMutation = useRejectInvite();
  const navigate = useNavigate();
  const [loadingStates, setLoadingStates] = useState<
    Record<string, "accept" | "reject" | null>
  >({});

  const handleAccept = async (inviteId: string) => {
    setLoadingStates((prev) => ({ ...prev, [inviteId]: "accept" }));
    try {
      const result = await acceptInviteMutation.mutateAsync(inviteId);

      const org = result.teamSlug;
      if (!result.ok || !org) {
        throw new Error("Failed to accept invitation. Please try again.");
      }

      setOpen(false);
      navigate(`/${org}`);
    } catch (error) {
      console.error("Accept invitation error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to accept invitation. Please try again.",
      );
    } finally {
      setLoadingStates((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  const handleReject = async (inviteId: string) => {
    setLoadingStates((prev) => ({ ...prev, [inviteId]: "reject" }));
    try {
      await rejectInviteMutation.mutateAsync({ id: inviteId });
      toast.success("Invitation declined");
    } catch (error) {
      console.error("Reject invitation error:", error);
      toast.error("Failed to decline invitation. Please try again.");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="w-8 h-8 relative">
                <Icon
                  name="inbox"
                  className="text-muted-foreground"
                  size={20}
                />
                {invites.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute bottom-1 right-1 size-2.5 flex items-center justify-center p-0 text-[10px] rounded-full outline-2 outline-sidebar outline-solid"
                  ></Badge>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Inbox</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-96 p-0 rounded-lg" align="end" side="bottom">
        <Tabs defaultValue="inbox" className="w-full gap-0">
          <TabsList variant="underline" className="w-full">
            <TabsTrigger
              value="inbox"
              variant="underline"
              className="flex-1 justify-center"
            >
              Inbox
            </TabsTrigger>
            <TabsTrigger
              value="whats-new"
              variant="underline"
              disabled
              className="flex-1 justify-center gap-1.5"
            >
              What's new
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                Soon
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inbox" className="p-1 m-0">
            {invites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Icon
                  name="move_to_inbox"
                  size={32}
                  className="text-muted-foreground mb-2"
                />
                <p className="text-sm text-muted-foreground">No invites</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {invites.map((invite) => (
                  <InviteItem
                    key={invite.id}
                    invite={invite}
                    onAccept={() => handleAccept(invite.id)}
                    onReject={() => handleReject(invite.id)}
                    loading={loadingStates[invite.id] || null}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="whats-new" className="p-4 m-0">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
