import { TriggerOutputSchema } from "@deco/sdk";
import { z } from "zod";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { timeAgo } from "../../utils/timeAgo.ts";
import { useState } from "react";
import { TriggerActions } from "./triggerActions.tsx";
import { TriggerType } from "./triggerType.tsx";
import { TriggerToggle } from "./triggerToggle.tsx";

type Trigger = z.infer<typeof TriggerOutputSchema>;

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
            <h3 className="text-lg font-semibold text-slate-900">
              {trigger.data.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <TriggerType trigger={trigger} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6 rounded-full overflow-hidden bg-slate-200">
            <img
              src={trigger.user?.metadata?.avatar_url ||
                "https://ui-avatars.com/api/?name=User"}
              alt="User avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-sm text-slate-600">
            {trigger.user?.metadata?.full_name || "Anonymous"}
          </span>
          <span className="text-sm text-slate-400 ml-auto">
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
