import { Form } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useMemo, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { SelectConnectionDialog } from "../integrations/add-connection-dialog.tsx";
import { IntegrationList } from "../toolsets/selector.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Integration } from "@deco/sdk";

type SetIntegrationTools = (
  integrationId: string,
  tools: string[] | null,
) => void;

const ADVANCED_INTEGRATIONS = [
  "i:user-management",
  "i:workspace-management",
  "i:knowledge-base-standard",
  "DECO_INTEGRATIONS",
  "DECO_UTILS",
];

function Connections({
  installedIntegrations,
  toolsSet,
  setIntegrationTools,
}: {
  installedIntegrations: Integration[];
  toolsSet: Record<string, string[]>;
  setIntegrationTools: SetIntegrationTools;
}) {
  const [search, setSearch] = useState("");
  const activeIntegrations = installedIntegrations.filter((integration) =>
    !!toolsSet[integration.id]
  );
  const filteredIntegrations = activeIntegrations.filter((integration) => {
    const searchTerm = search.toLowerCase();
    return (
      integration?.name?.toLowerCase().includes(searchTerm) ||
      integration?.description?.toLowerCase().includes(searchTerm)
    );
  });

  const orderedIntegrations = useMemo(() => {
    return filteredIntegrations.sort((a, b) => {
      const aIsActive = activeIntegrations.includes(a);
      const bIsActive = activeIntegrations.includes(b);
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      return 0;
    });
  }, [search, filteredIntegrations]);

  const connections = orderedIntegrations.filter((integration) =>
    integration.id.startsWith("i:")
  );

  const showAddConnectionEmptyState = connections.length === 0;
  return (
    <div className="flex flex-col gap-2">
      <h6 className="text-sm font-medium">Connections</h6>
      <div className="flex justify-between items-center">
        <span className="block text-sm text-muted-foreground pb-2">
          Connect and configure integrations to extend your agent's capabilities
          with external services.
        </span>
        {!showAddConnectionEmptyState && (
          <SelectConnectionDialog
            trigger={
              <Button variant="outline">
                <Icon name="add" /> Add connection
              </Button>
            }
          />
        )}
      </div>
      {showAddConnectionEmptyState
        ? (
          <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed relative overflow-hidden">
            <div className="absolute inset-0">
              <img
                src="/img/empty-state-agent-connections.svg"
                alt="No connections found"
                className="h-40"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-muted via-transparent to-muted" />
            </div>
            <div className="absolute z-10 flex flex-col items-center gap-2 bottom-6">
              <SelectConnectionDialog
                trigger={
                  <Button variant="outline">
                    <Icon name="add" /> Add connection
                  </Button>
                }
              />
            </div>
          </div>
        )
        : (
          <>
            <div className="flex gap-2 w-full">
              <div className="border border-border rounded-lg w-full">
                <div className="flex items-center h-10 px-4 gap-2">
                  <Icon
                    name="search"
                    size={20}
                    className="text-muted-foreground"
                  />
                  <Input
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 h-full border-none focus-visible:ring-0 placeholder:text-muted-foreground bg-transparent px-2"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex-1">
                <div className="flex flex-col gap-2">
                  <IntegrationList
                    integrations={connections}
                    toolsSet={toolsSet}
                    setIntegrationTools={setIntegrationTools}
                    onRemove={(integrationId) =>
                      setIntegrationTools(integrationId, null)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  );
}

function Knowledge() {
  return (
    <div className="flex flex-col gap-2">
      <h6 className="text-sm font-medium">Knowledge</h6>
      <div className="flex justify-between items-center">
        <span className="block text-sm text-muted-foreground pb-2">
          Directly attach files to the assistant knowledge base.
        </span>
      </div>
      <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
        <img
          src="/img/empty-state-agent-knowledge.svg"
          alt="No connections found"
          className="h-24 mb-4"
        />
        <Tooltip>
          <TooltipTrigger>
            <Button disabled variant="outline">
              <Icon name="add" /> Add files
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Coming soon</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function MultiAgent() {
  return (
    <div className="flex flex-col gap-2">
      <h6 className="text-sm font-medium">Multi-Agent</h6>
      <div className="flex justify-between items-center">
        <span className="block text-sm text-muted-foreground pb-2">
          Enable your agent to communicate with other agents for collaborative
          workflows.
        </span>
      </div>
      <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
        <SelectConnectionDialog
          title="Connect agent"
          filter={(integration) => integration.id.startsWith("a:")}
          onSelect={(integration) => {
            console.log(integration);
          }}
          trigger={
            <Button variant="outline">
              <Icon name="add" /> Add agent
            </Button>
          }
        />
      </div>
    </div>
  );
}

function ToolsAndKnowledgeTab() {
  const {
    form,
    handleSubmit,
    installedIntegrations,
  } = useAgentSettingsForm();

  const toolsSet = form.watch("tools_set");
  const setIntegrationTools = (
    integrationId: string,
    tools: string[] | null,
  ) => {
    const toolsSet = form.getValues("tools_set");
    const newToolsSet = { ...toolsSet };

    if (tools !== null) {
      newToolsSet[integrationId] = tools;
    } else {
      delete newToolsSet[integrationId];
    }

    form.setValue("tools_set", newToolsSet, { shouldDirty: true });
  };

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <Connections
              installedIntegrations={installedIntegrations}
              toolsSet={toolsSet}
              setIntegrationTools={setIntegrationTools}
            />
            <Knowledge />
            <MultiAgent />
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default ToolsAndKnowledgeTab;
