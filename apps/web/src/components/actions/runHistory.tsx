import { Badge } from "@deco/ui/components/badge.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { CodeBlock } from "./codeBlock.tsx";
import type { ListRunsResult, Run } from "@deco/sdk";

export function RunHistory({ runsData, isLoading }: {
  runsData: ListRunsResult | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <RunHistoryLoading />;
  }

  if (!runsData?.runs || runsData.runs.length === 0) {
    return <RunHistoryEmpty />;
  }

  return <RunHistoryTable runs={runsData.runs} />;
}

function RunHistoryLoading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function RunHistoryEmpty() {
  return (
    <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
      No runs yet
    </div>
  );
}

function RunHistoryTable({ runs }: { runs: Run[] }) {
  return (
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
            <TableHead className="whitespace-nowrap">Metadata</TableHead>
            <TableHead className="whitespace-nowrap">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => <RunHistoryRow key={run.id} run={run} />)}
        </TableBody>
      </Table>
    </div>
  );
}

function RunHistoryRow({ run }: { run: Run }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        {new Date(run.timestamp).toLocaleString()}
      </TableCell>
      <TableCell>
        <Badge
          variant={run.status === "success" ? "default" : "destructive"}
        >
          {run.status === "success" ? "Success" : "Failed"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="max-h-[80px] overflow-y-auto">
          <CodeBlock className="whitespace-pre-wrap break-all">
            {JSON.stringify(run.metadata, null, 2)}
          </CodeBlock>
        </div>
      </TableCell>
      <TableCell>
        <div className="max-h-[80px] overflow-y-auto">
          <CodeBlock className="whitespace-pre-wrap break-all">
            {JSON.stringify(run.result, null, 2)}
          </CodeBlock>
        </div>
      </TableCell>
    </TableRow>
  );
}
