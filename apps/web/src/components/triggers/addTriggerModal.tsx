import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { WebhookTriggerForm } from "./webhookTriggerForm.tsx";
import { CronTriggerForm } from "./cronTriggerForm.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

export function AddTriggerModal({ agentId }: { agentId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="flex items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
          title="Add Trigger"
        >
          <Icon name="add" className="text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create trigger</DialogTitle>
        </DialogHeader>
        <Tabs className="max-h-[85vh] overflow-y-auto pr-2">
          <TabsList className="mb-2 w-full bg-slate-100 rounded-full">
            <TabsTrigger
              value="webhook"
              className="flex-1 cursor-pointer rounded-full"
            >
              Webhook
            </TabsTrigger>
            <TabsTrigger
              value="cron"
              className="flex-1 cursor-pointer rounded-full"
            >
              Cron
            </TabsTrigger>
          </TabsList>
          <TabsContent value="webhook">
            <WebhookTriggerForm
              agentId={agentId}
            />
          </TabsContent>
          <TabsContent value="cron">
            <CronTriggerForm
              agentId={agentId}
              onSuccess={() => setIsOpen(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
