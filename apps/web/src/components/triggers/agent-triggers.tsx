import {
  type ListTriggersOutputSchema,
  useListTriggersByAgentId,
} from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useState } from "react";
import type { z } from "zod";
import { useChatContext } from "../chat/context.tsx";
import { TriggerModal as TriggerModalButton } from "./trigger-dialog.tsx";
import { TriggerCard } from "./trigger-card.tsx";
import { TriggerDetails } from "./trigger-details.tsx";
import { Button } from "@deco/ui/components/button.tsx";

export function AgentTriggers() {
  const { agentId } = useChatContext();
  const { data, isLoading } = useListTriggersByAgentId(agentId, {
    refetchOnMount: true,
    staleTime: 0,
  });
  const [selectedTrigger, setSelectedTrigger] = useState<
    z.infer<typeof ListTriggersOutputSchema>["triggers"][number] | null
  >(null);
  const [search, setSearch] = useState("");

  if (isLoading) {
    return <ListTriggersLoading />;
  }
  if (!data?.triggers?.length) {
    return <ListTriggersEmpty />;
  }
  if (selectedTrigger) {
    return (
      <TriggerDetails
        triggerId={selectedTrigger.id}
        agentId={agentId}
        onBack={() => setSelectedTrigger(null)}
      />
    );
  }

  const filteredTriggers = data.triggers.filter((trigger) =>
    trigger.data.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="py-8 flex flex-col gap-4 h-full max-w-3xl mx-auto">
      <div className="flex items-center gap-4 px-2">
        <div className="flex gap-2 flex-1">
          <div className="border border-border rounded-lg flex-1">
            <div className="flex items-center h-10 px-4 gap-2">
              <Icon
                name="search"
                size={20}
                className="text-muted-foreground"
              />
              <Input
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 h-full border-none focus-visible:ring-0 placeholder:text-muted-foreground bg-transparent px-2"
              />
            </div>
          </div>
        </div>
        <TriggerModalButton
          agentId={agentId}
          triggerAction={
            <Button
              variant="special"
              title="Add Trigger"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="add" />
              <span className="hidden md:inline">New trigger</span>
            </Button>
          }
        />
      </div>
      <ScrollArea className="flex-1 min-h-0 px-2">
        <div className="grid grid-cols-1 gap-4">
          {filteredTriggers.map((trigger, index) => (
            <TriggerCard
              key={`trigger-card-${trigger.id}-${index}`}
              trigger={trigger}
              onClick={() => setSelectedTrigger(trigger)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ListTriggersLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 mx-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`skeleton-${index}`} className="h-36 w-full" />
      ))}
    </div>
  );
}

export function ListTriggersEmpty() {
  const { agentId } = useChatContext();
  return (
    <div className="mx-2 p-4 mt-4 m-4 border border-dashed rounded-lg flex flex-col items-center justify-center text-center">
      <div className="bg-muted rounded-full p-3 mb-4 h-10">
        <Icon
          name="notifications_active"
          className="text-muted-foreground"
        />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        No triggers configured
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        Triggers allow you to trigger your agent on a schedule or from external
        systems.
      </p>
      <TriggerModalButton
        agentId={agentId}
        triggerAction={
          <Button
            variant="special"
            title="Add Trigger"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="add" />
            <span className="hidden md:inline">New Trigger</span>
          </Button>
        }
      />
    </div>
  );
}
