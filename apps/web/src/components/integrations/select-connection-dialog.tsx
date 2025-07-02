import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useMemo, useState } from "react";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Marketplace,
  type MarketplaceIntegration,
  NEW_CUSTOM_CONNECTION,
} from "./marketplace.tsx";
import { type Integration } from "@deco/sdk";
import { InstalledConnections } from "./installed-connections.tsx";
import { useCreateCustomConnection } from "../../hooks/use-create-custom-connection.ts";
import { Tabs, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";

type ConnectionsDialogEvent = {
  type: "select_connections";
  integrations: Integration[];
} | {
  type: "start_oauth";
  integration: MarketplaceIntegration;
};

type onEvent = (e: ConnectionsDialogEvent) => void | Promise<void>;

type AddConnectionDialogContentProps = {
  title?: string;
  filter?: (integration: Integration) => boolean;
  forceTab?: "my-connections" | "new-connection";
  myConnectionsEmptyState?: React.ReactNode;
  onEvent: onEvent;
};

type SelectConnectionDialogProps = AddConnectionDialogContentProps & {
  trigger?: React.ReactNode;
};

function AddConnectionDialogContent({
  title = "Add integration",
  filter,
  forceTab,
  myConnectionsEmptyState,
  onEvent,
}: AddConnectionDialogContentProps) {
  const [_tab, setTab] = useState<"my-connections" | "new-connection">(
    "my-connections",
  );
  const tab = forceTab ?? _tab;
  const [search, setSearch] = useState("");
  const createCustomConnection = useCreateCustomConnection();
  const [selectedConnections, setSelectedConnections] = useState<Integration[]>(
    [],
  );
  const showEmptyState = search.length > 0;

  const handleConnectionSelect = (integration: Integration) => {
    setSelectedConnections((prev) => {
      const isSelected = prev.some((conn) => conn.id === integration.id);
      if (isSelected) {
        return prev.filter((conn) => conn.id !== integration.id);
      } else {
        return [...prev, integration];
      }
    });
  };

  const handleConfirmMultiple = () => {
    onEvent({
      type: "select_connections",
      integrations: selectedConnections,
    });
  };

  const isConnectionSelected = (integration: Integration) => {
    return selectedConnections.some((conn) => conn.id === integration.id);
  };

  return (
    <DialogContent
      className="p-0 min-w-[80vw] min-h-[80vh] gap-0"
      closeButtonClassName="top-5 right-4"
    >
      <DialogHeader className="flex flex-row items-center p-4 h-auto">
        <DialogTitle className="text-left w-full">{title}</DialogTitle>
      </DialogHeader>
      {!forceTab && (
        <div className="flex justify-center w-full mt-2 mb-4">
          <Tabs
            value={tab}
            onValueChange={(v) =>
              setTab(v as "my-connections" | "new-connection")}
            className="w-fit"
          >
            <TabsList>
              <TabsTrigger value="new-connection" className="w-48">
                New integration
              </TabsTrigger>
              <TabsTrigger value="my-connections" className="w-48">
                Connected
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      <div className="flex flex-col h-[calc(100vh-14rem)] w-full px-8 pb-4">
        <Input
          placeholder="Find integration..."
          value={search}
          className="mb-4 w-full"
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex-1 overflow-y-auto w-full">
          {tab === "new-connection" && (
            <Marketplace
              filter={search}
              emptyState={
                <div className="flex flex-col h-full min-h-[200px] gap-4">
                  <div className="flex flex-col gap-2 py-8 w-full items-center">
                    <h3 className="text-2xl font-medium">
                      No integrations found for the search "{search}"
                    </h3>
                    <p className="text-sm text-muted-foreground w-full text-center">
                      You can{" "}
                      <Button
                        variant="link"
                        className="px-0"
                        onClick={() => setTab("my-connections")}
                      >
                        create a new custom integration
                      </Button>{" "}
                      instead.
                    </p>
                  </div>
                </div>
              }
              onClick={async (integration) => {
                if (integration.id === NEW_CUSTOM_CONNECTION.id) {
                  await createCustomConnection();
                  return;
                }
                onEvent({
                  type: "start_oauth",
                  integration,
                });
              }}
            />
          )}
          {tab === "my-connections" && (
            <InstalledConnections
              query={search}
              emptyState={showEmptyState
                ? myConnectionsEmptyState ?? (
                  <div className="flex flex-col h-full min-h-[200px] gap-4 pb-16">
                    <div className="w-full flex items-center flex-col gap-2 py-8">
                      <h3 className="text-2xl font-medium">
                        No integrations found
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Create a new integration to get started
                      </p>
                    </div>
                    <Marketplace
                      filter={search}
                      emptyState={
                        <div className="flex flex-col gap-2 py-8 w-full items-center">
                          <p className="text-sm text-muted-foreground">
                            No integrations found for the search "{search}"
                          </p>
                        </div>
                      }
                      onClick={async (integration) => {
                        if (integration.id === NEW_CUSTOM_CONNECTION.id) {
                          await createCustomConnection();
                          return;
                        }
                        onEvent({
                          type: "start_oauth",
                          integration,
                        });
                      }}
                    />
                  </div>
                )
                : null}
              filter={filter}
              onClick={handleConnectionSelect}
              isSelected={isConnectionSelected}
            />
          )}
        </div>
      </div>
      {tab === "my-connections" && selectedConnections.length > 0 && (
        <DialogFooter className="p-2 absolute bottom-0 left-0 right-0 border-t bg-background rounded-b-xl">
          <Button
            onClick={handleConfirmMultiple}
            disabled={selectedConnections.length === 0}
          >
            Select {selectedConnections.length}{" "}
            connection{selectedConnections.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
}

export function SelectConnectionDialog(props: SelectConnectionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useMemo(() => {
    if (props.trigger) {
      return props.trigger;
    }

    return (
      <Button variant="special">
        <span className="hidden md:inline">Add integration</span>
      </Button>
    );
  }, [props.trigger]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <AddConnectionDialogContent
        title={props.title}
        filter={props.filter}
        forceTab={props.forceTab}
        myConnectionsEmptyState={props.myConnectionsEmptyState}
        onEvent={(e) => {
          props.onEvent(e);
          setIsOpen(false);
        }}
      />
    </Dialog>
  );
}
