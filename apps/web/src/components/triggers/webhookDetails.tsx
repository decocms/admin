import { TriggerOutputSchema, WebhookTriggerOutputSchema } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { CodeBlock } from "./codeBlock.tsx";
import { z } from "zod";

export function WebhookDetails(
  { trigger }: { trigger: z.infer<typeof TriggerOutputSchema> },
) {
  const triggerData = trigger.data as z.infer<
    typeof WebhookTriggerOutputSchema
  >;
  return (
    <div className="space-y-4 border p-4 rounded-md bg-muted">
      <div className="flex items-center gap-2">
        <Icon name="webhook" className="h-5 w-5 text-special" />
        <h4 className="font-medium">Webhook Details</h4>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Webhook URL</div>
        <CodeBlock className="break-all">
          {triggerData.url}
        </CodeBlock>
      </div>

      {triggerData.passphrase && (
        <div>
          <div className="text-sm font-medium mb-1">Passphrase</div>
          <CodeBlock>{triggerData.passphrase}</CodeBlock>
        </div>
      )}

      {triggerData.schema && (
        <div>
          <div className="text-sm font-medium mb-1">Schema</div>
          <CodeBlock className="max-h-[200px] overflow-y-auto">
            {JSON.stringify(triggerData.schema, null, 2)}
          </CodeBlock>
        </div>
      )}

      {triggerData.outputTool && (
        <div>
          <div className="text-sm font-medium mb-1">Output Tool</div>
          <CodeBlock>{triggerData.outputTool}</CodeBlock>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Use this URL to trigger this trigger from external systems.
      </div>
    </div>
  );
}
