import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { FormControl, FormItem, FormLabel } from "@deco/ui/components/form.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  useBindings,
  useChannels,
  useCreateChannel,
  useLinkChannel,
  useRemoveChannel,
  useUnlinkChannel,
} from "@deco/sdk/hooks";
import { useMemo, useState } from "react";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Link } from "react-router";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { IntegrationIcon } from "../integrations/list/common.tsx";

interface ChannelsProps {
  className?: string;
}

export function Channels({ className }: ChannelsProps) {
  const { data: bindings } = useBindings("Channel");
  const [discriminator, setDiscriminator] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { agent } = useAgentSettingsForm();
  const { mutate: createChannel, isPending: isCreating } = useCreateChannel();
  const { mutate: linkChannel, isPending: isLinking } = useLinkChannel();
  const { mutate: unlinkChannel, isPending: isUnlinking } = useUnlinkChannel();
  const { mutate: removeChannel, isPending: isRemoving } = useRemoveChannel();
  const { data: channels } = useChannels();
  const workspaceLink = useWorkspaceLink();
  const [selectedBinding, setSelectedBinding] = useState<string | null>(null);
  const allChannels = channels?.channels || [];
  const agentChannels = useMemo(
    () => allChannels.filter((channel) => channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );
  const unlinkedChannels = useMemo(
    () => allChannels.filter((channel) => !channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );

  const handleLinkChannel = (channelId: string) => {
    linkChannel({
      channelId,
      discriminator: discriminator.trim(),
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

  const handleUnlinkChannel = (channelId: string) => {
    const channel = agentChannels.find((c) => c.id === channelId);
    if (!channel) return;

    unlinkChannel({
      channelId: channel.id,
      agentId: agent.id,
      discriminator: channel.discriminator,
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
    removeChannel(channelId, {
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
              onClick={() => handleUnlinkChannel(channel.id)}
              disabled={isUnlinking}
            >
              {isUnlinking
                ? <Spinner size="sm" />
                : <Icon name="close" size={16} />}
            </button>
          </div>
        );
      })}

      {unlinkedChannels.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Available Channels
          </p>
          {unlinkedChannels.map((channel) => {
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
                    onClick={() => handleLinkChannel(channel.id)}
                    disabled={isLinking}
                    className="h-6 px-2 text-xs"
                  >
                    {isLinking
                      ? (
                        <div className="flex items-center gap-1">
                          <Spinner size="sm" />
                          <span>Linking...</span>
                        </div>
                      )
                      : (
                        "Link"
                      )}
                  </Button>
                  <button
                    className="cursor-pointer hover:text-destructive"
                    type="button"
                    onClick={() => handleRemoveChannel(channel.id)}
                    disabled={isRemoving}
                  >
                    {isRemoving
                      ? <Spinner size="sm" />
                      : <Icon name="delete" size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        {showCreateForm && (
          <div className="space-y-4 p-4 border rounded-lg">
            {!bindings || bindings.length === 0
              ? (
                <Alert>
                  <Icon name="info" size={16} />
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
                          {bindings.map((binding) => (
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
                        handleCreateChannel(bindings[0].id);
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
        )}
      </div>
    </div>
  );
}

export default Channels;
