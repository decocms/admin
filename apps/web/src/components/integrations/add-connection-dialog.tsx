import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useMemo, useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useCreateCustomConnection } from "../../hooks/use-create-custom-connection.ts";
import { Marketplace } from "./list/marketplace.tsx";
import { Integration } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";

function AddConnectionDialogContent({
  title = "Add connection",
  filter,
  onSelect,
}: {
  title?: string;
  filter?: (integration: Integration) => boolean;
  onSelect?: (integration: Integration) => void;
}) {
  const [tab, setTab] = useState<"my-connections" | "new-connection">(
    "my-connections",
  );

  return (
    <DialogContent
      className="p-0 min-w-[80vw] min-h-[80vh] gap-0"
      closeButtonClassName="top-5 right-4"
    >
      <DialogHeader className="flex flex-row justify-between items-center p-2 h-14 px-5 pr-12">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="flex h-[calc(100vh-10rem)]">
        <aside className="w-56 flex flex-col p-4 gap-1">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-muted-foreground",
              tab === "my-connections" && "bg-muted text-foreground",
            )}
            onClick={() => setTab("my-connections")}
          >
            <Icon name="apps" size={16} className="text-muted-foreground" />
            <span>My connections</span>
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-muted-foreground",
              tab === "new-connection" && "bg-muted text-foreground",
            )}
            onClick={() => setTab("new-connection")}
          >
            <Icon name="add" size={16} className="text-muted-foreground" />
            <span>New connection</span>
          </Button>
          {/* Filters will go here */}
        </aside>
        {/* Main Content */}
        <div className="flex-1 max-h-full overflow-y-auto">
          <Marketplace />
        </div>
      </div>
    </DialogContent>
  );
}

interface SelectConnectionDialogProps {
  trigger?: React.ReactNode;
  title?: string;
  filter?: (integration: Integration) => boolean;
  onSelect?: (integration: Integration) => void;
}

export function SelectConnectionDialog(props: SelectConnectionDialogProps) {
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
      <AddConnectionDialogContent
        title={props.title}
        filter={props.filter}
        onSelect={props.onSelect}
      />
    </Dialog>
  );
}
