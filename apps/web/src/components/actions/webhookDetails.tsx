import { type Action } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { CodeBlock } from "./CodeBlock.tsx";

export function WebhookDetails({ action }: { action: Action }) {
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
