import type { Trigger } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import cronstrue from "cronstrue";

interface TriggerTypeProps {
  trigger: Trigger;
}

export function TriggerType({ trigger }: TriggerTypeProps) {
  if (trigger.type === "webhook") {
    return (
      <div className="flex items-center gap-1">
        <Icon name="device_hub" size={18} />
        Webhook
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Icon name="schedule" size={18} />
      {trigger.cronExp ? cronstrue.toString(trigger.cronExp) : trigger.cronExp}
    </div>
  );
}
