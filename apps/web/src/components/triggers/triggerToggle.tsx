import { useActivateTrigger, useDeactivateTrigger } from "@deco/sdk";
import { z } from "zod";
import { TriggerOutputSchema } from "@deco/sdk";
import { Switch } from "@deco/ui/components/switch.tsx";
import { useState } from "react";

export function TriggerToggle(
  { trigger }: { trigger: z.infer<typeof TriggerOutputSchema> },
) {
  const [isActive, setIsActive] = useState(trigger.active);
  const { mutate: activateTrigger } = useActivateTrigger(trigger.agent.id);
  const { mutate: deactivateTrigger } = useDeactivateTrigger(trigger.agent.id);

  const handleToggle = (checked: boolean) => {
    // Optimistically update UI
    setIsActive(checked);

    if (!checked) {
      deactivateTrigger(trigger.id, {
        onError: () => {
          // Revert on error
          setIsActive(!checked);
        },
      });
    } else {
      activateTrigger(trigger.id, {
        onError: () => {
          // Revert on error
          setIsActive(!checked);
        },
      });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div onClick={handleClick}>
      <Switch
        className="cursor-pointer"
        checked={isActive}
        onCheckedChange={handleToggle}
      />
    </div>
  );
}
