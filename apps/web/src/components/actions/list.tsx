import { type Action, useListActionRuns, useListActions } from "@deco/sdk";
import { useChatContext } from "../chat/context.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import cronstrue from "cronstrue";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

function ActionCard(
  { action, onClick }: { action: Action; onClick: (action: Action) => void },
) {
  const { title, message } = action;
  const description = message || "";

  return (
    <Card
      className="overflow-hidden border border-slate-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(action)}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <h3 className="text-base font-semibold line-clamp-1">{title}</h3>

        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center border border-input rounded-md p-1">
            <Icon
              name="calendar_today"
              className="w-4 h-4"
            />
          </div>
          <span>
            {action.cronExp ? cronstrue.toString(action.cronExp) : action.type}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionDetails(
  { action, onBack }: { action: Action; onBack: () => void },
) {
  const { agentId } = useChatContext();
  const { data: runsData, isLoading } = useListActionRuns(agentId, action.id);

  return (
    <div className="space-y-4 max-w-full">
      {/* Back button */}
      <Button
        variant="ghost"
        className="flex items-center gap-1 text-sm mb-2"
        onClick={onBack}
      >
        <Icon name="arrow_back" className="h-4 w-4" />
        Back to actions
      </Button>

      <h2 className="text-xl font-semibold">{action.title}</h2>

      <div>
        <h4 className="text-sm font-medium mb-1">Description</h4>
        <p className="text-sm text-muted-foreground">
          {action.message || "No description"}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-1">Trigger</h4>
        <div className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center border border-input rounded-md p-1">
            <Icon name="calendar_today" className="w-4 h-4" />
          </div>
          <span>
            {action.cronExp ? cronstrue.toString(action.cronExp) : action.type}
          </span>
        </div>
      </div>

      <div className="w-full">
        <h4 className="text-sm font-medium mb-2">Run History</h4>
        {isLoading
          ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )
          : runsData?.runs && runsData.runs.length > 0
          ? (
            <div className="w-full overflow-auto border rounded-md max-h-[400px]">
              <Table className="min-w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap w-[180px]">
                      Timestamp
                    </TableHead>
                    <TableHead className="whitespace-nowrap w-[100px]">
                      Status
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsData.runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(run.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={run.result ? "default" : "destructive"}
                        >
                          {run.result ? "Success" : "Failed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="break-all">
                        {run.result}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
          : (
            <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
              No runs yet
            </div>
          )}
      </div>
    </div>
  );
}

export function ListActions() {
  const { agentId } = useChatContext();
  const { data: actions, isLoading } = useListActions(agentId);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={`skeleton-${index}`} className="h-36 w-full" />
        ))}
      </div>
    );
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
    <div className="grid grid-cols-1 gap-4 w-full">
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
