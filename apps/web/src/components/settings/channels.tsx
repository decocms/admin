import {
  useBindings,
  useChannels,
  useCreateChannel,
  useJoinChannel,
  useLeaveChannel,
  useRemoveChannel,
} from "@deco/sdk/hooks";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { FormControl, FormItem, FormLabel } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { IntegrationIcon } from "../integrations/list/common.tsx";

interface ChannelsProps {
  className?: string;
}

export function Channels({ className }: ChannelsProps) {
  const { data: bindings, isPending: isLoadingBindings } = useBindings(
    "Channel",
  );
  const [discriminator, setDiscriminator] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { agent } = useAgentSettingsForm();
  const { mutate: createChannel, isPending: isCreating } = useCreateChannel();
  const linkChannelMutation = useLinkChannel();
  const unlinkChannelMutation = useUnlinkChannel();
  const { mutate: joinChannel, isPending: isJoining } = useJoinChannel();
  const { mutate: leaveChannel, isPending: isLeaving } = useLeaveChannel();
  const removeChannelMutation = useRemoveChannel();
  const { data: channels } = useChannels();
  const workspaceLink = useWorkspaceLink();
  const [selectedBinding, setSelectedBinding] = useState<string | null>(null);
  const allChannels = channels?.channels || [];
  const agentChannels = useMemo(
    () => allChannels.filter((channel) => channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );
  const nonJoinedChannels = useMemo(
    () => allChannels.filter((channel) => !channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );

  // Helper functions to check if specific channel is being processed
  const isChannelUnlinking = (channelId: string) => {
    return unlinkChannelMutation.isPending &&
      unlinkChannelMutation.variables?.channelId === channelId;
  };

  const isChannelLinking = (channelId: string) => {
    return linkChannelMutation.isPending &&
      linkChannelMutation.variables?.channelId === channelId;
  };

  const isChannelRemoving = (channelId: string) => {
    return removeChannelMutation.isPending &&
      removeChannelMutation.variables === channelId;
  };

    linkChannelMutation.mutate({
      channelId,
      agentId: agent.id,
    }, {
      onSuccess: () => {
        toast.success("Channel linked successfully");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to link channel",
        );
      },
    });
  };

  const handleLeaveChannel = (channelId: string) => {
    const channel = agentChannels.find((c) => c.id === channelId);
    if (!channel) return;

    unlinkChannelMutation.mutate({
      channelId: channel.id,
      agentId: agent.id,
    }, {
      onSuccess: () => {
        toast.success("Channel unlinked successfully");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to unlink channel",
        );
      },
    });
  };

  const handleCreateChannel = (bindingId: string) => {
    const selectedBinding = bindings?.find((b) => b.id === bindingId);
    if (!selectedBinding) {
      toast.error("Please select a binding first");
      return;
    }

    if (!discriminator.trim()) {
      toast.error("Please enter a discriminator");
      return;
    }

    createChannel({
      discriminator: discriminator.trim(),
      integrationId: selectedBinding.id,
      agentId: agent.id,
    }, {
      onSuccess: () => {
        toast.success("Channel created successfully");
        setDiscriminator("");
        setShowCreateForm(false);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to create channel",
        );
      },
    });
  };

  const handleRemoveChannel = (channelId: string) => {
    removeChannelMutation.mutate(channelId, {
      onSuccess: () => {
        toast.success("Channel removed successfully");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to remove channel",
        );
      },
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-2">
        <div className="flex w-full justify-between items-center">
          <div>
            <h3 className="text-sm font-medium text-foreground leading-">
              Channels
            </h3>
            <p className="text-xs font-normal text-muted-foreground">
              These are the channels your agent can find users on and
              communicate with them
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="gap-2 h-8 w-8"
            type="button"
          >
            <Icon name="add" size={16} />
          </Button>
        </div>
      </div>

      {agentChannels.map((channel) => {
        return (
          <div
            key={channel.id}
            className="border border-input rounded-xl py-2 px-3 h-10 flex gap-2 items-center"
          >
            <div className="flex items-center gap-2">
              <IntegrationIcon
                name={channel.integration?.name ?? "Unknown"}
                icon={channel.integration?.icon ?? ""}
                className="before:hidden w-10 h-10"
              />
              <p className="text-sm text-foreground font-medium">
                {channel.integration?.name ?? "Unknown"}
              </p>
              <span className="text-sm text-foreground font-normal">
                {channel.discriminator}
              </span>
            </div>
            <button
              className="ml-auto cursor-pointer"
              type="button"
              onClick={() => handleLeaveChannel(channel.id)}
              disabled={isChannelUnlinking(channel.id)}
            >
              {isChannelUnlinking(channel.id)
                ? <Spinner size="sm" />
                : <Icon name="close" size={16} />}
            </button>
          </div>
        );
      })}

      {nonJoinedChannels.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Available Channels
          </p>
          {nonJoinedChannels.map((channel) => {
            const integration = channel.integration;
            return (
              <div
                key={channel.id}
                className="border border-input rounded-xl py-2 px-3 h-10 flex gap-2 items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <IntegrationIcon
                    className="!border-none w-6 h-6"
                    name={integration?.name ?? "Unknown"}
                    icon={integration?.icon ?? ""}
                  />
                  <span className="text-sm text-foreground">
                    {channel.discriminator}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {integration?.name || "Unknown"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleJoinChannel(channel.id)}
                    disabled={isChannelLinking(channel.id)}
                    className="h-6 px-2 text-xs"
                  >
                    {isChannelLinking(channel.id)
                      ? (
                        <div className="flex items-center gap-1">
                          <Spinner size="xs" />
                          <span>Joining...</span>
                        </div>
                      )
                      : (
                        "Join"
                      )}
                  </Button>
                  <button
                    className="cursor-pointer hover:text-destructive"
                    type="button"
                    onClick={() => handleRemoveChannel(channel.id)}
                    disabled={isChannelRemoving(channel.id)}
                  >
                    {isChannelRemoving(channel.id)
                      ? <Spinner size="xs" />
                      : <Icon name="delete" size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!showCreateForm
        ? null
        : (!bindings || bindings.length === 0)
        ? isLoadingBindings
          ? (
            <div className="w-full flex items-center gap-2">
              <Spinner size="sm" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          )
          : (
            <Alert>
              <AlertDescription>
                No channel integrations available. You need to install
                integrations first.
                <Link
                  to={workspaceLink("/integrations")}
                  className="ml-2 text-primary hover:underline"
                >
                  Go to Integrations →
                </Link>
              </AlertDescription>
            </Alert>
          )
        : (
          <>
            <FormItem>
              <FormLabel>Integration</FormLabel>
              <FormControl>
                <Select
                  value={selectedBinding ?? ""}
                  onValueChange={(bindingId) => {
                    setSelectedBinding(bindingId);
                    if (discriminator.trim()) {
                      handleCreateChannel(bindingId);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an integration" />
                  </SelectTrigger>
                  <SelectContent>
                    {bindings?.map((binding) => (
                      <SelectItem key={binding.id} value={binding.id}>
                        <div className="flex items-center gap-2">
                          {binding.icon
                            ? (
                              <IntegrationIcon
                                className="before:hidden w-10 h-10"
                                name={binding.name}
                                icon={binding.icon}
                              />
                            )
                            : <Icon name="chat" size={16} />}
                          <span>{binding.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>

            <div className="space-y-2">
              <Label htmlFor="discriminator">
                Discriminator (unique identifier)
              </Label>
              <Input
                id="discriminator"
                placeholder="Enter unique identifier (e.g., phone number for WhatsApp)"
                value={discriminator}
                onChange={(e) => setDiscriminator(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setDiscriminator("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                disabled={!discriminator.trim() || isCreating}
                onClick={() => {
                  if (bindings) {
                    handleCreateChannel(bindings[0].id);
                  }
                }}
                className="gap-2"
              >
                {isCreating
                  ? (
                    <>
                      <Spinner size="sm" />
                      Creating...
                    </>
                  )
                  : (
                    <>
                      <Icon name="add" size={16} />
                      Create Channel
                    </>
                  )}
              </Button>
            </div>
          </>
        )}
    </div>
  );
}

export default Channels;
