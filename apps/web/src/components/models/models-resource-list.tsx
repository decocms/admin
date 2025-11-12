import { type ReactNode } from "react";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import {
  useCreateModelV2,
  formatIntegrationId,
  WellKnownMcpGroups,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useThread } from "../decopilot/thread-provider.tsx";

/**
 * Models Resource List Component
 * Displays custom models (Resources V2) stored in deconfig
 * 
 * TODO: This is a placeholder implementation. A full implementation would include:
 * - Rich form for creating/editing models
 * - Model testing interface
 * - Cost estimation
 * - Capability badges
 */
export function ModelsResourceList({
  headerSlot,
}: {
  headerSlot?: ReactNode;
} = {}) {
  const createModel = useCreateModelV2();
  const { addTab } = useThread();

  const handleCreateModel = async () => {
    const newModel = await createModel.mutateAsync({
      name: "New Model",
      description: "",
      provider: "openai",
      modelId: "gpt-4",
      supports: ["streaming", "tool-calling"],
      limits: [
        { name: "contextWindow", value: "128000" },
        { name: "maxTokens", value: "4096" },
      ],
    });

    // Navigate to the newly created model's detail page
    if (newModel) {
      addTab({
        type: "detail",
        resourceUri: newModel.uri,
        title: newModel.data.name || "New Model",
        icon: "psychology",
      });
    }
  };

  const newModelButton = (
    <Button variant="default" size="sm" onClick={handleCreateModel}>
      <Icon name="add" />
      New model
    </Button>
  );

  const agentsV2IntegrationId = formatIntegrationId(WellKnownMcpGroups.AgentsV2);

  return (
    <ResourcesV2List
      integrationId={agentsV2IntegrationId}
      resourceName="model"
      headerSlot={headerSlot}
      customCtaButton={newModelButton}
    />
  );
}

