import type { Trigger } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { DeleteTriggerModal } from "./deleteTriggerModal.tsx";

interface TriggerActionsProps {
  trigger: Trigger;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TriggerActions(
  { trigger, open, onOpenChange }: TriggerActionsProps,
) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="more_vert" size={20} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            className="text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(true);
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteTriggerModal
        trigger={trigger}
        agentId={trigger.agent?.id || ""}
        open={open}
        onOpenChange={onOpenChange}
      />
    </>
  );
}
