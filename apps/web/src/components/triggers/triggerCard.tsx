import { type Trigger, useDeleteTrigger } from "@deco/sdk";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import cronstrue from "cronstrue";
import { timeAgo } from "../../utils/timeAgo.ts";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@deco/ui/components/dialog.tsx";
import { useState } from "react";

export function TriggerCard({ trigger, onClick, agentId }: {
  trigger: Trigger;
  onClick: (trigger: Trigger) => void;
  agentId: string;
}) {
  return (
    <Card className="overflow-hidden border border-slate-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer relative">
      <CardContent
        className="p-6 flex flex-col gap-4"
        onClick={() => onClick(trigger)}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {trigger.title}
          </h3>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <TriggerIcon type={trigger.type} />
            <TriggerType trigger={trigger} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6 rounded-full overflow-hidden bg-slate-200">
            <img
              src={trigger.author?.avatar ||
                "https://ui-avatars.com/api/?name=User"}
              alt="User avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-sm text-slate-600">
            {trigger.author?.name || "Anonymous"}
          </span>
          <span className="text-sm text-slate-400 ml-auto">
            {timeAgo(new Date(trigger.createdAt || ""))}
          </span>
        </div>
      </CardContent>
      <TriggerActions trigger={trigger} agentId={agentId} />
    </Card>
  );
}

function TriggerIcon({ type }: { type: Trigger["type"] }) {
  return (
    <div className="flex items-center justify-center">
      {type === "cron" && (
        <Icon name="schedule" className="text-muted-foreground" />
      )}
      {type === "webhook" && (
        <Icon name="webhook" className="text-muted-foreground" />
      )}
    </div>
  );
}

function TriggerType({ trigger }: { trigger: Trigger }) {
  return (
    <span>
      {trigger.cronExp ? cronstrue.toString(trigger.cronExp) : trigger.type}
    </span>
  );
}

function TriggerActions({ trigger, agentId }: {
  trigger: Trigger;
  agentId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-6 right-6"
          >
            <Icon name="more_vert" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            className="text-red-500"
            onClick={() => setOpen(true)}
          >
            Delete Trigger
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteTriggerModal
        trigger={trigger}
        agentId={agentId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

const DeleteTriggerModal = (
  { trigger, agentId, open, onOpenChange }: {
    trigger: Trigger;
    agentId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  },
) => {
  const { mutate: deleteTrigger } = useDeleteTrigger(agentId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>Delete Trigger</DialogHeader>
        <DialogDescription>
          Are you sure you want to delete this trigger?
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              deleteTrigger(trigger.id);
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
