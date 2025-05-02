import { type Trigger, useListTriggers } from "@deco/sdk";
import { useChatContext } from "../chat/context.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { TriggerCard } from "./triggerCard.tsx";
import { TriggerDetails } from "./triggerDetails.tsx";
import { Input } from "@deco/ui/components/input.tsx";

export function ListTriggers() {
  const { agentId } = useChatContext();
  const { data: triggers, isLoading } = useListTriggers(agentId, {
    refetchOnMount: true,
    staleTime: 0,
  });
  const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);
  const [search, setSearch] = useState("");

  if (isLoading) {
    return <ListTriggersLoading />;
  }
  if (!triggers?.actions?.length) {
    return <ListTriggersEmpty />;
  }
  if (selectedTrigger) {
    return (
      <TriggerDetails
        trigger={selectedTrigger}
        onBack={() => setSelectedTrigger(null)}
      />
    );
  }

  const filteredTriggers = triggers.actions.filter((trigger) =>
    trigger.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-16 pb-16">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2 rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {filteredTriggers.map((trigger, index) => (
          <TriggerCard
            key={`real-${index}`}
            trigger={trigger}
            onClick={(trigger) => setSelectedTrigger(trigger)}
          />
        ))}
      </div>
    </div>
  );
}

export function ListTriggersLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 mx-16">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`skeleton-${index}`} className="h-36 w-full" />
      ))}
    </div>
  );
}

export function ListTriggersEmpty() {
  return (
    <div className="mx-16 p-4 mt-4 m-4 border border-dashed rounded-lg flex flex-col items-center justify-center text-center">
      <div className="bg-slate-100 rounded-full p-3 mb-4 h-10">
        <Icon
          name="notifications_active"
          className="text-slate-500"
        />
      </div>
      <h3 className="text-lg font-medium mb-2">No triggers configured</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        Triggers allow you to trigger your agent on a schedule or from external
        systems.
      </p>
    </div>
  );
}
