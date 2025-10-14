import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface SearchComingSoonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchComingSoonModal({
  open,
  onOpenChange,
}: SearchComingSoonModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Icon
                name="search"
                size={24}
                className="text-accent-foreground"
              />
            </div>
            <div>
              <DialogTitle>Search Coming Soon</DialogTitle>
              <DialogDescription>
                Powerful search across your workspace
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Soon search is coming to all resources and tools in your project.
            You'll be able to quickly find documents, agents, workflows, tools,
            and more with intelligent search.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
