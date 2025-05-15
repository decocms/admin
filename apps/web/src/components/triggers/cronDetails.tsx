import { CronTriggerSchema, TriggerOutputSchema } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { CodeBlock } from "./codeBlock.tsx";
import cronstrue from "cronstrue";
import { z } from "zod";

export function CronDetails(
  { trigger }: { trigger: z.infer<typeof TriggerOutputSchema> },
) {
  const triggerData = trigger.data as z.infer<typeof CronTriggerSchema>;
  return (
    <div className="space-y-4 border p-4 rounded-md bg-slate-50">
      <div className="flex items-center gap-2">
        <Icon name="calendar_today" className="h-5 w-5 text-green-500" />
        <h4 className="font-medium">Schedule Details</h4>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Cron Expression</div>
        <CodeBlock>{triggerData.cronExp}</CodeBlock>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Runs At</div>
        <div className="text-sm">
          {triggerData.cronExp
            ? cronstrue.toString(triggerData.cronExp)
            : triggerData.cronExp}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Prompt</div>
        <CodeBlock>
          {JSON.stringify(triggerData.prompt, null, 2)}
        </CodeBlock>
      </div>
    </div>
  );
}
