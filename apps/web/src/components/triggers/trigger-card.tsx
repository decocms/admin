import type { TriggerOutputSchema } from "@deco/sdk";
import type { z } from "zod";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { timeAgo } from "../../utils/time-ago.ts";
import { useState } from "react";
import { TriggerActions } from "./trigger-actions.tsx";
import { TriggerType } from "./trigger-type.tsx";
import { TriggerToggle } from "./trigger-toggle.tsx";

export type Trigger = z.infer<typeof TriggerOutputSchema>;

export function TriggerCard({ trigger, onClick }: {
  trigger: Trigger;
  onClick: (trigger: Trigger) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden border rounded-xl hover:shadow-md transition-shadow cursor-pointer relative">
      <CardContent
        className="p-6 flex flex-col gap-4"
        onClick={() => onClick(trigger)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <TriggerToggle trigger={trigger} />
            <h3 className="text-lg font-semibold text-foreground">
              {trigger.data.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <TriggerType trigger={trigger} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6 rounded-full overflow-hidden bg-muted">
            <img
              src={trigger.user?.metadata?.avatar_url ||
                "https://ui-avatars.com/api/?name=User"}
              alt="User avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {trigger.user?.metadata?.full_name || "Anonymous"}
          </span>
          <span className="text-sm text-muted-foreground/50 ml-auto">
            {timeAgo(new Date(trigger.createdAt || ""))}
          </span>
        </div>
      </CardContent>
      <div className="absolute top-6 right-6">
        <TriggerActions
          trigger={trigger}
          open={open}
          onOpenChange={setOpen}
        />
      </div>
    </Card>
  );
}
