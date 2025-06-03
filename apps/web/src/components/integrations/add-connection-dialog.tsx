import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useMemo } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useCreateCustomConnection } from "../../hooks/use-create-custom-connection.ts";
import { MarketplaceTab } from "./list/marketplace.tsx";

function AddConnectionDialogContent() {
  const createCustomConnection = useCreateCustomConnection();

  return (
    <DialogContent
      className="p-0 min-w-[80vw] min-h-[80vh] gap-0"
      closeButtonClassName="top-5 right-4"
    >
      <DialogHeader className="flex flex-row justify-between items-center p-2 border-b border-border h-14 px-5 pr-12">
        <DialogTitle>Add connection</DialogTitle>
        <Button variant="outline" size="sm" onClick={createCustomConnection}>
          <Icon name="handyman" size={16} />
          <span className="hidden md:inline">Add custom connection</span>
        </Button>
      </DialogHeader>
      <div className="max-h-[calc(100vh-10rem)] overflow-y-auto">
        <MarketplaceTab />
      </div>
    </DialogContent>
  );
}

interface AddConnectionDialogProps {
  trigger?: React.ReactNode;
}

export function AddConnectionDialog(props: AddConnectionDialogProps) {
  const trigger = useMemo(() => {
    if (props.trigger) {
      return props.trigger;
    }

    return (
      <Button variant="special">
        <span className="hidden md:inline">Add connection</span>
      </Button>
    );
  }, [props.trigger]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <AddConnectionDialogContent />
    </Dialog>
  );
}
