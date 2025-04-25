import { type Action } from "@deco/sdk";
import { useListActionRuns } from "@deco/sdk";
import { useChatContext } from "../chat/context.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { WebhookDetails } from "./webhookDetails.tsx";
import { CronDetails } from "./cronDetails.tsx";
import { RunHistory } from "./runHistory.tsx";

export function ActionDetails({ action, onBack }: {
  action: Action;
  onBack: () => void;
}) {
  const { agentId } = useChatContext();
  const { data: runsData, isLoading } = useListActionRuns(agentId, action.id, {
    refetchOnMount: true,
    staleTime: 0,
  });

  return (
    <div className="p-4 space-y-6 max-w-full">
      <Button
        variant="ghost"
        className="flex items-center gap-1 text-sm mb-2"
        onClick={onBack}
      >
        <Icon name="arrow_back" className="h-4 w-4" />
        Back to actions
      </Button>

      <div className="flex items-center gap-2">
        <ActionIcon type={action.type} />
        <h2 className="text-xl font-semibold">{action.title}</h2>
        <Badge variant="outline" className="ml-2">
          {action.type}
        </Badge>
      </div>

      {action.description && (
        <div>
          <h4 className="text-sm font-medium mb-1">Description</h4>
          <p className="text-sm text-muted-foreground">
            {action.description}
          </p>
        </div>
      )}

      {action.type === "webhook" && <WebhookDetails action={action} />}
      {action.type === "cron" && <CronDetails action={action} />}

      <div className="w-full">
        <h4 className="text-sm font-medium mb-2">Run History</h4>
        <RunHistory runsData={runsData} isLoading={isLoading} />
      </div>
    </div>
  );
}

function ActionIcon({ type }: { type: Action["type"] }) {
  return (
    <div className="flex items-center justify-center p-2 bg-primary/10 rounded-md">
      {type === "cron" && (
        <Icon name="calendar_today" className="text-primary" />
      )}
      {type === "webhook" && <Icon name="webhook" className="text-primary" />}
    </div>
  );
}
