import { useListActions } from "@deco/sdk";
import { useChatContext } from "../chat/context.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import cronstrue from "cronstrue";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";

type ActionCardProps = {
  title: string;
  description: string;
  trigger: string;
  icons?: string[];
};

function ActionCard(
  { title, description, trigger, icons = [] }: ActionCardProps,
) {
  return (
    <Card className="overflow-hidden border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col gap-3">
        {icons.length > 0 && (
          <div className="flex gap-1">
            {icons.map((icon, index) => (
              <div
                key={index}
                className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 border border-slate-200"
              >
                <Icon name={icon} className="h-5 w-5" />
              </div>
            ))}
          </div>
        )}

        <h3 className="text-base font-semibold line-clamp-1">{title}</h3>

        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center border border-input rounded-md p-1">
            <Icon
              name="calendar_today"
              className="w-4 h-4 "
            />
          </div>
          <span>{trigger}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ListActions() {
  const { agentId } = useChatContext();
  const { data: actions, isLoading } = useListActions(agentId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={`skeleton-${index}`} className="h-36 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {actions?.actions?.map((action, index) => (
        <ActionCard
          key={`real-${index}`}
          title={action.title}
          description={action.message || ""}
          trigger={cronstrue.toString(action.cronExp || "")}
          icons={[]}
        />
      ))}
    </div>
  );
}
