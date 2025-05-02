import { type Action, useListActions } from "@deco/sdk";
import { useChatContext } from "../chat/context.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ActionCard } from "./actionCard.tsx";
import { ActionDetails } from "./actionDetails.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";

export function ListActions() {
  const { agentId } = useChatContext();
  const { data: actions, isLoading } = useListActions(agentId, {
    refetchOnMount: true,
    staleTime: 0,
  });
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [search, setSearch] = useState("");

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

  const filteredActions = actions.actions.filter((action) =>
    action.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-16">
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
        <Button
          variant="ghost"
          size="icon"
          className="flex items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
          title="Add Action"
        >
          <Icon name="add" className="text-slate-500" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {filteredActions.map((action, index) => (
          <ActionCard
            key={`real-${index}`}
            action={action}
            onClick={(action) => setSelectedAction(action)}
          />
        ))}
      </div>
    </div>
  );
}

export function ListActionsLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 mx-16">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`skeleton-${index}`} className="h-36 w-full" />
      ))}
    </div>
  );
}

export function ListActionsEmpty() {
  return (
    <div className="mx-16 m-4 mt-0 border border-dashed rounded-lg flex flex-col items-center justify-center text-center">
      <div className="bg-slate-100 rounded-full p-3 mb-4 h-10">
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
