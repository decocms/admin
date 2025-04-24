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
import { cn } from "@deco/ui/lib/utils.ts";

// Simple code display component
function CodeBlock(
  { children, className }: { children: React.ReactNode; className?: string },
) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof children === "string") {
      navigator.clipboard.writeText(children);
    } else {
      // If children is not a string, attempt to convert it to a string
      const text = String(children);
      navigator.clipboard.writeText(text);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="relative group">
      <pre
        className={cn(
          "rounded-md bg-slate-100 p-2 text-xs font-mono whitespace-pre-wrap pr-10",
          className,
        )}
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-0 right-0 p-2 cursor-pointer"
        aria-label="Copy to clipboard"
      >
        <Icon name={copied ? "check" : "content_copy"} className="" />
      </button>
    </div>
  );
}

function ActionCard(
  { action, onClick }: { action: Action; onClick: (action: Action) => void },
) {
  const { title, description, type } = action;

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
              name={type === "cron" ? "calendar_today" : "webhook"}
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

function WebhookDetails({ action }: { action: Action }) {
  return (
    <div className="space-y-4 border p-4 rounded-md bg-slate-50">
      <div className="flex items-center gap-2">
        <Icon name="webhook" className="h-5 w-5 text-blue-500" />
        <h4 className="font-medium">Webhook Details</h4>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Webhook URL</div>
        <CodeBlock className="break-all">
          {action.url}
        </CodeBlock>
      </div>

      {action.passphrase && (
        <div>
          <div className="text-sm font-medium mb-1">Passphrase</div>
          <CodeBlock>{action.passphrase}</CodeBlock>
        </div>
      )}

      {action.schema && (
        <div>
          <div className="text-sm font-medium mb-1">Schema</div>
          <CodeBlock className="max-h-[200px] overflow-y-auto">
            {JSON.stringify(action.schema, null, 2)}
          </CodeBlock>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Use this URL to trigger this action from external systems.
      </div>
    </div>
  );
}

function CronDetails({ action }: { action: Action }) {
  return (
    <div className="space-y-4 border p-4 rounded-md bg-slate-50">
      <div className="flex items-center gap-2">
        <Icon name="calendar_today" className="h-5 w-5 text-green-500" />
        <h4 className="font-medium">Schedule Details</h4>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Cron Expression</div>
        <CodeBlock>{action.cronExp}</CodeBlock>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Runs At</div>
        <div className="text-sm">
          {action.cronExp
            ? cronstrue.toString(action.cronExp)
            : "Unknown schedule"}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Prompt</div>
        <CodeBlock>
          {JSON.stringify(action.prompt, null, 2)}
        </CodeBlock>
      </div>
    </div>
  );
}

function formatRunResult(result: string) {
  try {
    // Try to parse as JSON
    const jsonResult = JSON.parse(result);
    return JSON.stringify(jsonResult, null, 2);
  } catch (_) {
    // If not valid JSON, return as is
    return result;
  }
}

function ActionDetails(
  { action, onBack }: { action: Action; onBack: () => void },
) {
  const { agentId } = useChatContext();
  const { data: runsData, isLoading } = useListActionRuns(agentId, action.id);
  console.log(runsData);
  return (
    <div className="space-y-6 max-w-full">
      {/* Back button */}
      <Button
        variant="ghost"
        className="flex items-center gap-1 text-sm mb-2"
        onClick={onBack}
      >
        <Icon name="arrow_back" className="h-4 w-4" />
        Back to actions
      </Button>

      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center p-2 bg-primary/10 rounded-md">
          <Icon
            name={action.type === "cron" ? "calendar_today" : "webhook"}
            className="text-primary"
          />
        </div>
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

      {/* Type-specific details */}
      {action.type === "webhook"
        ? <WebhookDetails action={action} />
        : action.type === "cron"
        ? <CronDetails action={action} />
        : null}

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
                  {runsData.runs.map((run) => {
                    // Extract status from result if possible
                    let status = "Success";
                    try {
                      const resultObj = JSON.parse(run.result);
                      if (resultObj.status) {
                        status = resultObj.status;
                      }
                    } catch (e) {
                      // If the result isn't JSON or doesn't have a status field, use default
                      status = run.result.includes("error")
                        ? "Failed"
                        : "Success";
                    }

                    return (
                      <TableRow key={run.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(run.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status.toLowerCase().includes("error") ||
                                status.toLowerCase().includes("fail")
                              ? "destructive"
                              : "default"}
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-h-[80px] overflow-y-auto">
                            <CodeBlock className="whitespace-pre-wrap break-all">
                              {formatRunResult(run.result)}
                            </CodeBlock>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
