import { type Action } from "@deco/sdk";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import cronstrue from "cronstrue";

export function ActionCard({ action, onClick }: {
  action: Action;
  onClick: (action: Action) => void;
}) {
  return (
    <Card
      className="overflow-hidden border border-slate-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(action)}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <h3 className="text-base font-semibold line-clamp-1">{action.title}</h3>

        <p className="text-sm text-muted-foreground line-clamp-2">
          {action.description}
        </p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ActionIcon type={action.type} />
          <span>
            {action.cronExp ? cronstrue.toString(action.cronExp) : action.type}
          </span>
        </div>
      </CardContent>
    </Card>
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
