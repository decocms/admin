import { Icon } from "@deco/ui/components/icon.tsx";
import cronstrue from "cronstrue";
import { TriggerOutputSchema } from "@deco/sdk";
import { z } from "zod";

export function TriggerType(
  { trigger }: {
    trigger: z.infer<typeof TriggerOutputSchema>;
  },
) {
  console.log("trigger", trigger);
  if (trigger.data.type === "webhook") {
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
      {trigger.data.cron_exp
        ? cronstrue.toString(trigger.data.cron_exp)
        : trigger.data.cron_exp}
    </div>
  );
}
