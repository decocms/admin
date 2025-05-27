import { type Integration as IntegrationType } from "@deco/sdk";
import { Form, FormControl } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { IntegrationList } from "../toolsets/selector.tsx";
import { Chiplet } from "../common/ListPageHeader.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";

const tabs = [
  {
    id: "tools",
    label: "Tools",
  },
  {
    id: "agents",
    label: "Agents",
    count: 0,
  },
  {
    id: "advanced",
    label: "Advanced",
    count: 0,
  },
];

const ADVANCED_INTEGRATIONS = [
  "i:user-management",
  "i:workspace-management",
  "i:knowledge-base-standard",
  "DECO_INTEGRATIONS",
  "DECO_UTILS",
];

function IntegrationsTab() {
  const {
    form,
    handleSubmit,
    installedIntegrations,
  } = useAgentSettingsForm();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<("All" | "Active" | "Inactive")>("All");
  const [activeTab, setActiveTab] = useState("tools");

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

  const usedIntegrations = installedIntegrations.filter((integration) =>
    !!toolsSet[integration.id]?.length
  );

  const filteredIntegrations = installedIntegrations.filter((integration) => {
    let shouldShow = false;

    if (integration.name.toLowerCase().includes(search.toLowerCase())) {
      shouldShow = true;
    }

    if (integration.description.toLowerCase().includes(search.toLowerCase())) {
      shouldShow = true;
    }

    if (filter === "Active" && shouldShow) {
      shouldShow = usedIntegrations.includes(integration);
    }

    if (filter === "Inactive" && shouldShow) {
      shouldShow = !usedIntegrations.includes(integration);
    }

    return shouldShow;
  });

  const toolsIntegrations = filteredIntegrations.filter((integration) =>
    !ADVANCED_INTEGRATIONS.includes(integration.id) &&
    integration.id.startsWith("i:")
  );

  const agentsIntegrations = filteredIntegrations.filter((integration) =>
    !ADVANCED_INTEGRATIONS.includes(integration.id) &&
    integration.id.startsWith("a:")
  );

  const advancedIntegrations = filteredIntegrations.filter((integration) =>
    ADVANCED_INTEGRATIONS.includes(integration.id)
  );

  const toolsMap = {
    "tools": toolsIntegrations,
    "agents": agentsIntegrations,
    "advanced": advancedIntegrations,
    "active": usedIntegrations,
  };

  const tools = tabs.map((tab) => {
    return {
      ...tab,
      active: tab.id === activeTab,
      count: toolsMap[tab.id as keyof typeof toolsMap].length,
    };
  });

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full px-4 py-2 max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-2"
          >
            <div className="flex gap-2">
              {tools.map((tab) => {
                return (
                  <Chiplet
                    key={tab.id}
                    item={tab}
                    onClick={() => setActiveTab(tab.id)}
                  />
                );
              })}
            </div>
            <div className="flex gap-2 w-full">
              <div className="border border-slate-200 rounded-lg w-full">
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
              <Select
                onValueChange={(value) =>
                  setFilter(value as "All" | "Active" | "Inactive")}
                value={filter}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a connection type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {["All", "Active", "Inactive"].map((filter) => (
                    <SelectItem
                      key={filter}
                      value={filter}
                    >
                      {filter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
