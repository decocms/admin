import { type Trigger } from "@deco/sdk";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import cronstrue from "cronstrue";
import { timeAgo } from "../../utils/timeAgo.ts";

export function TriggerCard({ trigger, onClick }: {
  trigger: Trigger;
  onClick: (trigger: Trigger) => void;
}) {
  return (
    <Card
      className="overflow-hidden border border-slate-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(trigger)}
    >
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {trigger.title}
          </h3>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <TriggerIcon type={trigger.type} />
            <TriggerType trigger={trigger} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6 rounded-full overflow-hidden bg-slate-200">
            <img
              src={trigger.author?.avatar ||
                "https://ui-avatars.com/api/?name=User"}
              alt="User avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-sm text-slate-600">
            {trigger.author?.name || "Anonymous"}
          </span>
          <span className="text-sm text-slate-400 ml-auto">
            {timeAgo(new Date(trigger.createdAt || ""))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TriggerIcon({ type }: { type: Trigger["type"] }) {
  return (
    <div className="flex items-center justify-center">
      {type === "cron" && (
        <Icon name="schedule" className="text-muted-foreground" />
      )}
      {type === "webhook" && (
        <Icon name="webhook" className="text-muted-foreground" />
      )}
    </div>
  );
}

function TriggerType({ trigger }: { trigger: Trigger }) {
  return (
    <span>
      {trigger.cronExp ? cronstrue.toString(trigger.cronExp) : trigger.type}
    </span>
  );
}
