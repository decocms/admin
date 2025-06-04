import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  useBindings,
  useChannels,
  useCreateChannel,
  useLinkChannel,
} from "@deco/sdk/hooks";
import { useState } from "react";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Channel } from "@deco/sdk/models";

type Binding = NonNullable<ReturnType<typeof useBindings>["data"]>[number];

function ChannelCard(
  { binding, selected, setSelected }: {
    binding: Binding;
    selected: Binding | null;
    setSelected: (binding: Binding | null) => void;
  },
) {
  if (!binding) return null;
  const isConnected = true;
  const isSelected = selected?.id === binding.id;
  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all duration-200 hover:shadow-md border-2",
        isSelected
          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
          : isConnected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50",
      )}
    >
      <CardContent
        onClick={() => {
          setSelected(isSelected ? null : binding);
        }}
        className="p-4 flex flex-col items-center justify-center aspect-square"
      >
        <div
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-lg mb-2",
            isConnected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon name="chat" size={20} />
        </div>
        <span className="block text-xs font-medium text-center leading-tight max-w-full truncate">
          {binding.name}
        </span>
        {isConnected && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ChannelsProps {
  className?: string;
}

export function Channels({ className }: ChannelsProps) {
  const { data: bindings } = useBindings("Channel");
  const [selectedBinding, setSelectedBinding] = useState<Binding | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [discriminator, setDiscriminator] = useState("");
  const { agent } = useAgentSettingsForm();
  const { mutate: createChannel, isPending } = useCreateChannel();
  const { mutate: linkChannel, isPending: isLinking } = useLinkChannel();
  const { data: channels } = useChannels();

  const handleAddConnection = () => {
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
      name: `${agent.name} - ${selectedBinding.name}`,
      integrationId: selectedBinding.id,
      agentId: agent.id,
    }, {
      onSuccess: () => {
        toast.success("Channel created successfully");
        setSelectedBinding(null);
        setDiscriminator("");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to create channel",
        );
      },
    });
  };

  const handleLinkChannel = () => {
    if (!selectedChannel) {
      toast.error("Please select a channel first");
      return;
    }

    if (!discriminator.trim()) {
      linkChannel({
        channelId: selectedChannel.id,
        discriminator: discriminator.trim(),
        agentId: agent.id,
      });
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Channels</h3>
        <p className="text-sm text-muted-foreground">
          Connect and configure integrations to extend your agent's capabilities
          with external services.
        </p>
      </div>

      {channels?.channels.map((channel) => (
        <div key={channel.id}>
          <p>{channel.discriminator}</p>
          {channel.agentId === agent.id && <p>Linked</p>}
        </div>
      ))}

      <div>
        Choose Channel
      </div>

      <div className="grid grid-cols-6 gap-4">
        {bindings?.map((binding) => (
          <ChannelCard
            key={binding.id}
            binding={binding}
            selected={selectedBinding}
            setSelected={setSelectedBinding}
          />
        ))}
      </div>

      {selectedBinding && (
        <div className="space-y-2">
          <Label htmlFor="discriminator">
            Discriminator {selectedBinding.name === "WhatsApp"
              ? "(e.g., phone number)"
              : "(unique identifier)"}
          </Label>
          <Input
            id="discriminator"
            placeholder={selectedBinding.name === "WhatsApp"
              ? "Enter phone number (e.g., +1234567890)"
              : "Enter unique identifier"}
            value={discriminator}
            onChange={(e) => setDiscriminator(e.target.value)}
            className="max-w-md"
          />
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Button
          variant={selectedBinding ? "default" : "outline"}
          onClick={handleAddConnection}
          disabled={!selectedBinding || !discriminator.trim() || isPending}
          className="gap-2"
        >
          <Icon name="add" size={16} />
          {isPending
            ? "Creating..."
            : selectedBinding
            ? `Create channel with ${selectedBinding.name}`
            : "Select a binding to create channel"}
        </Button>
      </div>
    </div>
  );
}

export default Channels;
