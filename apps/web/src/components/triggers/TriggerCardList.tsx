import type { Trigger } from "@deco/sdk";
import { TriggerCard } from "./triggerCard.tsx";

interface TriggerCardListProps {
  triggers: Trigger[];
  onTriggerClick?: (trigger: Trigger) => void;
  className?: string;
}

export function TriggerCardList(
  { triggers, onTriggerClick, className }: TriggerCardListProps,
) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${className}`}>
      {triggers.map((trigger, index) => (
        <TriggerCard
          key={`trigger-card-${trigger.id}-${index}`}
          trigger={trigger}
          onClick={onTriggerClick ?? (() => {})}
        />
      ))}
    </div>
  );
}
