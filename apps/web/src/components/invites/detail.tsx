import { Suspense } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useAcceptInvite, useInvites, useRejectInvite } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { TopbarLayout } from "../layout/home.tsx";
import { Avatar } from "../common/avatar/index.tsx";

function InviteDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: invites = [] } = useInvites();
  const acceptInviteMutation = useAcceptInvite();
  const rejectInviteMutation = useRejectInvite();
  const navigate = useNavigate();

  const invite = invites.find((inv) => inv.id === id);

  const handleAccept = async () => {
    if (!invite) return;

    try {
      const result = await acceptInviteMutation.mutateAsync(invite.id);

      const org = result.teamSlug;
      if (!result.ok || !org) {
        throw new Error("Failed to accept invitation. Please try again.");
      }

      toast.success(`Welcome to ${invite.teamName}!`);
      navigate(`/${org}`);
    } catch (error) {
      console.error("Accept invitation error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to accept invitation. Please try again.",
      );
    }
  };

  const handleReject = async () => {
    if (!invite) return;

    try {
      await rejectInviteMutation.mutateAsync({ id: invite.id });
      toast.success("Invitation declined");
      navigate("/invites");
    } catch (error) {
      console.error("Reject invitation error:", error);
      toast.error("Failed to decline invitation");
    }
  };

  if (!invite) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <div className="sticky left-0 px-4 lg:px-6 xl:px-10 pt-12 pb-4 md:pb-6 lg:pb-8 z-10 bg-background">
            <div className="max-w-[1600px] mx-auto w-full">
              <h1 className="text-2xl font-semibold">Team Invitation</h1>
            </div>
          </div>
          <div className="px-4 lg:px-6 xl:px-10">
            <div className="max-w-[1600px] mx-auto w-full pb-8 flex items-center justify-center min-h-96">
              <EmptyState
                icon="move_to_inbox"
                title="Invitation Not Found"
                description="This invitation doesn't exist or has already been accepted."
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isLoading =
    acceptInviteMutation.isPending || rejectInviteMutation.isPending;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto flex items-center justify-center px-4 lg:px-6 xl:px-10 py-12">
        <Card className="overflow-hidden bg-background border border-border max-w-md w-full">
          <CardContent className="px-10 py-12 flex flex-col items-center text-center gap-6 min-h-[400px] justify-between">
            {/* Top Section */}
            <div className="flex flex-col items-center gap-4">
              {/* Team Avatar and Invitation Text */}
              <div className="flex flex-col items-center gap-2">
                <Avatar
                  url=""
                  fallback={invite.teamName}
                  size="lg"
                  className="size-14"
                />
                <p className="text-2xl leading-8">
                  <span className="font-medium">
                    {invite.inviter.name ||
                      invite.inviter.email?.split("@")[0] ||
                      "Someone"}
                  </span>
                  {" invited you to"}
                  <br />
                  {"join "}
                  <span className="font-medium">{invite.teamName}</span>
                </p>
              </div>

              {/* Role Badge */}
              {invite.roles.length > 0 && (
                <Badge variant="secondary" className="px-2 py-1">
                  {invite.roles
                    .map(
                      (role) =>
                        role.name.charAt(0).toUpperCase() + role.name.slice(1),
                    )
                    .join(", ")}
                </Badge>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1 w-full">
              <Button
                onClick={handleReject}
                disabled={isLoading}
                variant="secondary"
                className="flex-1 h-10"
              >
                {rejectInviteMutation.isPending ? (
                  <Spinner size="xs" />
                ) : (
                  "Decline"
                )}
              </Button>
              <Button
                onClick={handleAccept}
                disabled={isLoading}
                variant="default"
                className="flex-1 h-10"
              >
                {acceptInviteMutation.isPending ? (
                  <Spinner size="xs" />
                ) : (
                  "Accept invitation"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InviteDetailSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="sticky left-0 px-4 lg:px-6 xl:px-10 pt-12 pb-4 md:pb-6 lg:pb-8 z-10 bg-background">
          <div className="max-w-[1600px] mx-auto w-full">
            <div className="h-8 bg-muted rounded animate-pulse w-48"></div>
          </div>
        </div>
        <div className="px-4 lg:px-6 xl:px-10">
          <div className="max-w-[800px] mx-auto w-full pb-8">
            <Card className="overflow-hidden bg-card border-0">
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="size-16 bg-muted rounded-2xl animate-pulse"></div>
                  <div className="space-y-2 w-full">
                    <div className="h-8 bg-muted rounded animate-pulse w-48 mx-auto"></div>
                    <div className="h-5 bg-muted rounded animate-pulse w-64 mx-auto"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 bg-muted rounded animate-pulse w-20"></div>
                    <div className="h-6 bg-muted rounded animate-pulse w-24"></div>
                  </div>
                  <div className="flex gap-3 pt-4 w-full max-w-md">
                    <div className="h-12 bg-muted rounded animate-pulse flex-1"></div>
                    <div className="h-12 bg-muted rounded animate-pulse flex-1"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteDetailWrapper() {
  return (
    <Suspense fallback={<InviteDetailSkeleton />}>
      <InviteDetailContent />
    </Suspense>
  );
}

export default function InviteDetail() {
  return (
    <TopbarLayout breadcrumb={[{ label: "Team Invitation", link: "/invites" }]}>
      <InviteDetailWrapper />
    </TopbarLayout>
  );
}
