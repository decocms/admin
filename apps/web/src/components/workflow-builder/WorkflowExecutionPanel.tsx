import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";

interface ExecutionState {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  currentStep?: string;
  stepResults: Record<string, any>;
  logs: Array<{ type: "log" | "warn" | "error"; content: string }>;
  startTime: number;
  endTime?: number;
}

interface WorkflowExecutionPanelProps {
  executionState?: ExecutionState;
  onReplayStep?: (stepName: string) => void;
}

export function WorkflowExecutionPanel({
  executionState,
  onReplayStep,
}: WorkflowExecutionPanelProps) {
  if (!executionState) {
    return null;
  }

  const getStatusBadge = (status: ExecutionState["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "running":
        return <Badge variant="default">Running</Badge>;
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600">
            Completed
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  const getLogIcon = (type: "log" | "warn" | "error") => {
    switch (type) {
      case "log":
        return <Icon name="info" className="h-3 w-3 text-blue-600" />;
      case "warn":
        return <Icon name="warning" className="h-3 w-3 text-yellow-600" />;
      case "error":
        return <Icon name="error" className="h-3 w-3 text-red-600" />;
    }
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Workflow Execution</CardTitle>
            {getStatusBadge(executionState.status)}
          </div>
          {executionState.currentStep && (
            <p className="text-xs text-muted-foreground">
              Current Step: {executionState.currentStep}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step Results */}
          {Object.keys(executionState.stepResults).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Step Results</h4>
              <div className="space-y-2">
                {Object.entries(executionState.stepResults).map(
                  ([stepName, result]) => (
                    <div
                      key={stepName}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <span className="text-xs font-medium">{stepName}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Completed
                        </Badge>
                        {onReplayStep && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onReplayStep(stepName)}
                            className="h-6 px-2"
                          >
                            <Icon name="refresh" className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Logs */}
          {executionState.logs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Execution Logs</h4>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {executionState.logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      {getLogIcon(log.type)}
                      <span className="flex-1">{log.content}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Execution Time */}
          <div className="text-xs text-muted-foreground">
            Started: {new Date(executionState.startTime).toLocaleTimeString()}
            {executionState.endTime && (
              <span className="ml-4">
                Ended: {new Date(executionState.endTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
