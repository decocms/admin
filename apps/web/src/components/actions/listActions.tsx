import { type Action, useListActions } from "@deco/sdk";
import { useChatContext } from "../chat/context.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ActionCard } from "./ActionCard.tsx";
import { ActionDetails } from "./ActionDetails.tsx";

export function ListActions() {
  const { agentId } = useChatContext();
  const { data: actions, isLoading } = useListActions(agentId, {
    refetchOnMount: true,
    staleTime: 0,
  });
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  if (isLoading) {
    return <ListActionsLoading />;
  }

  if (!actions?.actions?.length) {
    return <ListActionsEmpty />;
  }

  if (selectedAction) {
    return (
      <ActionDetails
        action={selectedAction}
        onBack={() => setSelectedAction(null)}
      />
    );
  }

  return (
    <div className="p-4 grid grid-cols-1 gap-4 w-full">
      {actions?.actions?.map((action, index) => (
        <ActionCard
          key={`real-${index}`}
          action={action}
          onClick={(action) => setSelectedAction(action)}
        />
      ))}
    </div>
  );
}

export function ListActionsLoading() {
  return (
    <div className="p-4 grid grid-cols-1 gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`skeleton-${index}`} className="h-36 w-full" />
      ))}
    </div>
  );
}

export function ListActionsEmpty() {
  return (
    <div className="p-4 border border-dashed rounded-lg flex flex-col items-center justify-center text-center">
      <div className="bg-slate-100 rounded-full p-3 mb-4">
        <Icon
          name="notifications_active"
          className="text-slate-500"
        />
      </div>
      <h3 className="text-lg font-medium mb-2">No actions configured</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        Actions allow you to trigger your agent on a schedule or from external
        systems.
      </p>
    </div>
  );
}
