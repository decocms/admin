import {
  type Integration as IntegrationType
} from "@deco/sdk";
import {
  Form
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { IntegrationList } from "../toolsets/selector.tsx";

const tabs = [
  {
    id: "all",
    name: "Tools"
  },
  {
    id: "agents",
    name: "Agents"
  },
  {
    id: "advanced",
    name: "Advanced"
  },
]

const ADVANCED_INTEGRATIONS = ["i:user-management", "i:workspace-management", "i:knowledge-base-standard", "DECO_INTEGRATIONS", "DECO_UTILS"]

function IntegrationsTab() {
  const {
    form,
    handleSubmit,
    installedIntegrations,
  } = useAgentSettingsForm();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all")

  const toolsSet = form.watch("tools_set");
  const setIntegrationTools = (
    integrationId: string,
    tools: string[],
  ) => {
    const toolsSet = form.getValues("tools_set");
    const newToolsSet = { ...toolsSet };

    if (tools.length > 0) {
      newToolsSet[integrationId] = tools;
    } else {
      delete newToolsSet[integrationId];
    }

    form.setValue("tools_set", newToolsSet, { shouldDirty: true });
  };

  const filteredIntegrations = installedIntegrations.filter((integration) => {
    if(integration.name.toLowerCase().includes(search.toLowerCase())) {
      return true;
    }

    if(integration.description.toLowerCase().includes(search.toLowerCase())) {
      return true;
    }
  })

  console.log("filteredIntegrations", filteredIntegrations);

  const allIntegrations = filteredIntegrations.filter((integration) =>
    !ADVANCED_INTEGRATIONS.includes(integration.id)
  );

  const usedIntegrations = filteredIntegrations.filter((integration) =>
    !!toolsSet[integration.id]?.length
  );

  const advancedIntegrations = filteredIntegrations.filter((integration) =>
    ADVANCED_INTEGRATIONS.includes(integration.id)
  );

  const toolsMap = {
    "advanced": advancedIntegrations,
    "active": usedIntegrations,
    "all": allIntegrations,
    "agents": allIntegrations,
  }

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full px-4 py-2 max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-2"
          >
          <div className="flex gap-2">
            {
              tabs.map(tab => {
                return (
                <div
                  className="block cursor-pointer"
                  onClick={() => {
                    setActiveTab(tab.id)
                  }}
                >
                  <div className={cn("rounded-xl border border-slate-200 px-4 py-2 text-slate-700 font-normal text-sm inline-block",
                    tab.id === activeTab && "bg-slate-100"
                  )}>
                    {tab.name}
                  </div>
                </div>
                )
              })
            }
          </div>
            <div className="border border-slate-200 rounded-lg">
              <div className="flex items-center h-10 px-4 gap-2">
                <Icon name="search" size={20} className="text-slate-400" />
                <Input
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 h-full border-none focus-visible:ring-0 placeholder:text-slate-500 bg-transparent px-2"
                />
              </div>
            </div>

            {/* Tools Section */}
            <div className="space-y-2 mb-8">
              <div className="flex-1">
                <div className="flex flex-col gap-2">
                  <IntegrationList
                    integrations={toolsMap[activeTab as keyof typeof toolsMap]}
                    selectedIntegration={null}
                    toolsSet={toolsSet}
                    selectedTools={usedIntegrations}
                    setIntegrationTools={setIntegrationTools}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default IntegrationsTab;
