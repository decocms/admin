import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface LinkResourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkResourceModal({
  open,
  onOpenChange,
}: LinkResourceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Local Development</DialogTitle>
          <DialogDescription>Coming soon to decocms.com</DialogDescription>
        </DialogHeader>
        <div className="py-6">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30">
              <Icon name="terminal" size={32} className="text-primary" />
            </div>
          </div>
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Soon you'll be able to clone and work on your projects locally
              using:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm border">
              <code className="text-foreground">
                git clone admin.decocms.com/my-team/my-project
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Work locally with your favorite editor and sync changes seamlessly
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
