import { type Action } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { CodeBlock } from "./CodeBlock.tsx";
import cronstrue from "cronstrue";

export function CronDetails({ action }: { action: Action }) {
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
          {action.cronExp ? cronstrue.toString(action.cronExp) : action.cronExp}
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
