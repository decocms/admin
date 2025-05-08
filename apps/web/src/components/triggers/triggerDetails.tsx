import { type Trigger, useListTriggersByAgentId } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { WebhookDetails } from "./webhookDetails.tsx";
import { CronDetails } from "./cronDetails.tsx";
import { useParams } from "react-router";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { AuditListContent } from "../audit/list.tsx";

export function TriggerDetails(
  { triggerId: _triggerId, onBack, agentId: _agentId }: {
    triggerId?: string;
    onBack?: () => void;
    agentId?: string;
  },
) {
  const params = useParams();
  const agentId = _agentId || params.agentId;
  const triggerId = _triggerId || params.triggerId;

  if (!agentId || !triggerId) {
    return <div>No agent or trigger ID</div>;
  }

  const { data: triggers, isLoading } = useListTriggersByAgentId(agentId);
  const trigger = triggers?.actions?.find((t) => t.id === triggerId);

  if (!trigger || isLoading) {
    return <TriggerDetailsSkeleton />;
  }

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      globalThis.history.back();
    }
  };

  return (
    <div className="mx-2 space-y-6 max-w-full py-8">
      <Button
        variant="ghost"
        className="flex items-center gap-1 text-sm mb-2"
        onClick={handleBack}
      >
        <Icon name="arrow_back" className="h-4 w-4" />
        Back to triggers
      </Button>

      <div className="flex items-center gap-2">
        <TriggerIcon type={trigger.type} />
        <h2 className="text-xl font-semibold">{trigger.title}</h2>
        <Badge variant="outline" className="ml-2">
          {trigger.type}
        </Badge>
      </div>

      {trigger.description && (
        <div>
          <h4 className="text-sm font-medium mb-1">Description</h4>
          <p className="text-sm text-muted-foreground">
            {trigger.description}
          </p>
        </div>
      )}

      {trigger.type === "webhook" && <WebhookDetails trigger={trigger} />}
      {trigger.type === "cron" && <CronDetails trigger={trigger} />}

      <div className="mt-10">
        <h3 className="text-lg font-semibold mb-2">Logs</h3>
        <AuditListContent
          showFilters={false}
          options={{ resourceId: trigger.id, agentId }}
        />
      </div>
    </div>
  );
}

function TriggerIcon({ type }: { type: Trigger["type"] }) {
  return (
    <div className="flex items-center justify-center p-2 bg-primary/10 rounded-md">
      {type === "cron" && (
        <Icon name="calendar_today" className="text-primary" />
      )}
      {type === "webhook" && <Icon name="webhook" className="text-primary" />}
    </div>
  );
}

export function TriggerDetailsSkeleton() {
  return (
    <div className="mx-2 space-y-6 max-w-full py-8">
      <Skeleton className="w-32 h-8 mb-2" />
      <div className="flex items-center gap-2">
        <Skeleton className="w-8 h-8 rounded-md" />
        <Skeleton className="w-48 h-6" />
        <Skeleton className="w-16 h-6 ml-2" />
      </div>
      <Skeleton className="w-1/2 h-4 mt-4" />
      <Skeleton className="w-full h-24 mt-4" />
    </div>
  );
}
