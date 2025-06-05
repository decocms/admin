import {
  useBindings,
  useChannels,
  useConnectionChannels,
  useCreateChannel,
  useJoinChannel,
  useLeaveChannel,
  useRemoveChannel,
} from "@deco/sdk/hooks";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
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
import { MCPConnection } from "@deco/sdk";
import { Channel } from "@deco/sdk/models";

interface ChannelsProps {
  className?: string;
}

interface ChannelCardProps {
  channel: Channel;
  children: React.ReactNode;
  variant?: "agent" | "available";
}

function ChannelCard(
  { channel, children, variant = "agent" }: ChannelCardProps,
) {
  const integration = channel.integration;
  const isAgentVariant = variant === "agent";

  return (
    <div
      className={cn(
        "border border-input rounded-xl py-2 px-3 h-10 flex gap-2 items-center",
        !isAgentVariant && "justify-between",
      )}
    >
      <div className="flex items-center gap-2">
        <IntegrationIcon
          name={integration?.name ?? "Unknown"}
          icon={integration?.icon ?? ""}
          className={cn(
            "before:hidden w-10 h-10",
          )}
        />

        <p className="text-sm text-foreground font-medium">
          {integration?.name ?? "Unknown"}
        </p>
        <span className="text-sm text-foreground font-normal">
          {channel.name ?? channel.discriminator}
        </span>
      </div>
      {children}
    </div>
  );
}

export function Channels({ className }: ChannelsProps) {
  const { data: bindings, isPending: isLoadingBindings } = useBindings(
    "Channel",
  );
  const [discriminator, setDiscriminator] = useState("");
  const [name, setName] = useState<string | undefined>(undefined);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { agent } = useAgentSettingsForm();
  const { mutate: createChannel, isPending: isCreating } = useCreateChannel();
  const joinChannelMutation = useJoinChannel();
  const leaveChannelMutation = useLeaveChannel();
  const removeChannelMutation = useRemoveChannel();
  const { data: channels } = useChannels();
  const workspaceLink = useWorkspaceLink();
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(
    null,
  );
  const allChannels = channels?.channels || [];
  const agentChannels = useMemo(
    () => allChannels.filter((channel) => channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );
  const availableChannels = useMemo(
    () => allChannels.filter((channel) => !channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );
  const selectedBinding = useMemo(
    () => bindings?.find((b) => b.id === selectedBindingId),
    [bindings, selectedBindingId],
  );

  // Helper functions to check if specific channel is being processed
  const isLeavingChannel = (channelId: string) => {
    return leaveChannelMutation.isPending &&
      leaveChannelMutation.variables?.channelId === channelId;
  };

  const isJoiningChannel = (channelId: string) => {
    return joinChannelMutation.isPending &&
      joinChannelMutation.variables?.channelId === channelId;
  };

  const isChannelRemoving = (channelId: string) => {
    return removeChannelMutation.isPending &&
      removeChannelMutation.variables === channelId;
  };

  const handleJoinChannel = (channelId: string) => {
    joinChannelMutation.mutate({
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

    leaveChannelMutation.mutate({
      channelId: channel.id,
      agentId: agent.id,
    }, {
      onSuccess: () => {
        toast.success("Channel left successfully");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to leave channel",
        );
      },
    });
  };

  const handleCreateChannel = (bindingId: string) => {
    const selectedBinding = bindings?.find((b) => b.id === bindingId);
    if (!selectedBinding) {
      toast.error("Please select a integration first");
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
      name: name?.trim(),
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
        <div className="flex w-full justify-between gap-2 items-center">
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
        if (!channel) return null;
        return (
          <ChannelCard key={channel.id} channel={channel} variant="agent">
            <button
              className="ml-auto cursor-pointer"
              type="button"
              onClick={() => handleLeaveChannel(channel.id)}
              disabled={isLeavingChannel(channel.id)}
            >
              {isLeavingChannel(channel.id)
                ? <Spinner size="sm" />
                : <Icon name="close" size={16} />}
            </button>
          </ChannelCard>
        );
      })}

      {availableChannels.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Available Channels
          </p>
          {availableChannels.map((channel) => {
            if (!channel) return null;
            return (
              <ChannelCard
                key={channel.id}
                channel={channel}
                variant="available"
              >
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleJoinChannel(channel.id)}
                    disabled={isJoiningChannel(channel.id)}
                    className="h-6 px-2 text-xs"
                  >
                    {isJoiningChannel(channel.id)
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
              </ChannelCard>
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
                  value={selectedBindingId ?? ""}
                  onValueChange={(bindingId) => {
                    setSelectedBindingId(bindingId);
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
              {selectedBinding &&
                (
                  <ConnectionChannels
                    key={selectedBindingId}
                    connection={selectedBinding?.connection}
                    discriminator={discriminator}
                    setDiscriminator={setDiscriminator}
                    setName={setName}
                  />
                )}
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

function ConnectionChannels(
  { connection, discriminator, setDiscriminator, setName }: {
    connection: MCPConnection;
    discriminator: string;
    setDiscriminator: (discriminator: string) => void;
    setName: (name: string | undefined) => void;
  },
) {
  const { data: availableChannels, isLoading: isLoadingAvailableChannels } =
    useConnectionChannels(connection);
  return (
    <div className="w-full">
      <Label htmlFor="discriminator">
        Channel
      </Label>
      <div className="mt-2 w-full">
        <Select
          onValueChange={(value) => {
            const nameForChannel = availableChannels?.channels?.find((
              channel,
            ) => channel.value === value)?.label;
            setDiscriminator(value);
            setName(nameForChannel);
          }}
          disabled={isLoadingAvailableChannels}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a channel" />
          </SelectTrigger>
          <SelectContent className="w-full">
            {availableChannels?.channels?.map((channel) => {
              return (
                <SelectItem key={channel.value} value={channel.value}>
                  {channel.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {(!availableChannels?.channels && !isLoadingAvailableChannels) && (
          <Input
            id="discriminator"
            placeholder="Enter unique identifier (e.g., phone number for WhatsApp)"
            value={discriminator}
            onChange={(e) => setDiscriminator(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

export default Channels;
