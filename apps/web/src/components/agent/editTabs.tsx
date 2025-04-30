import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import AgentSettings from "../settings/agent.tsx";
import { ListActions } from "../actions/listActions.tsx";

export default function EditTabs() {
  const style = `
    .custom-tabs {
        padding: 0 !important;
        border-radius: 0;
    }
    .custom-tabs [role="tab"] {
        background: none !important;
        box-shadow: none !important;
        border-bottom: 1.5px solid #e2e8f0;
        border: none !important;
        color: #64748b;
        font-weight: 500;
        font-size: 14px;
        padding: 10px 24px;
        transition: color 0.2s;
    }
    .custom-tabs [role="tab"][data-state="active"] {
        color: #22293b;
        border-bottom: 1.5px solid #22293b !important;
        border-radius: 0 !important;
        background: none;
        box-shadow: none;
    }
    .custom-tabs [role="tab"]:not([data-state=\"active\"]) {
        color: #64748b;
        border-bottom: 1.5px solid #e2e8f0 !important;
        border-radius: 0 !important;
    }
  `;
  return (
    <>
      <style>{style}</style>
      <Tabs defaultValue="agent" className="gap-8">
        <TabsList className="custom-tabs flex border-0 bg-transparent !mx-16 py-0">
          <TabsTrigger value="agent">Agent</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <TabsContent value="agent">
          <AgentSettings formId="agent-settings-form" />
        </TabsContent>
        <TabsContent value="triggers">
          <ListActions />
        </TabsContent>
        <TabsContent value="advanced">
          <div>Advanced</div>
        </TabsContent>
      </Tabs>
    </>
  );
}
