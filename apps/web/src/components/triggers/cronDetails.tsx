import { type Trigger } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { CodeBlock } from "./codeBlock.tsx";
import cronstrue from "cronstrue";

export function CronDetails({ trigger }: { trigger: Trigger }) {
  return (
    <div className="space-y-4 border p-4 rounded-md bg-slate-50">
      <div className="flex items-center gap-2">
        <Icon name="calendar_today" className="h-5 w-5 text-green-500" />
        <h4 className="font-medium">Schedule Details</h4>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Cron Expression</div>
        <CodeBlock>{trigger.cronExp}</CodeBlock>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Runs At</div>
        <div className="text-sm">
          {trigger.cronExp
            ? cronstrue.toString(trigger.cronExp)
            : trigger.cronExp}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Prompt</div>
        <CodeBlock>
          {JSON.stringify(trigger.prompt, null, 2)}
        </CodeBlock>
      </div>
    </div>
  );
}
