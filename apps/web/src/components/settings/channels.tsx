import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useBindings, useCreateChannel } from "@deco/sdk/hooks";
import { useState } from "react";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

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
        <span className="text-xs font-medium text-center leading-tight">
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
  const [selected, setSelected] = useState<Binding | null>(null);
  const { agent } = useAgentSettingsForm();
  const { mutate: createChannel, isPending } = useCreateChannel();

  const handleAddConnection = () => {
    if (!selected) {
      toast.error("Please select a binding first");
      return;
    }

    createChannel({
      discriminator: `${selected.name}`, // TODO: find out how to get the correct discriminator (ex: user phone number for WhatsApp)
      name: `${agent.name} - ${selected.name}`,
      integrationId: selected.id,
      agentId: agent.id,
    }, {
      onSuccess: () => {
        toast.success("Channel created successfully");
        setSelected(null);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to create channel",
        );
      },
    });
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

      <div className="grid grid-cols-6 gap-4">
        {bindings?.map((binding) => (
          <ChannelCard
            key={binding.id}
            binding={binding}
            selected={selected}
            setSelected={setSelected}
          />
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Button
          variant={selected ? "default" : "outline"}
          onClick={handleAddConnection}
          disabled={!selected || isPending}
          className="gap-2"
        >
          <Icon name="add" size={16} />
          {isPending
            ? "Creating..."
            : selected
            ? `Create channel with ${selected.name}`
            : "Select a binding to create channel"}
        </Button>
      </div>
    </div>
  );
}

export default Channels;
