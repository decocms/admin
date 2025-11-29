import { DEFAULT_MODEL, useModels, WELL_KNOWN_MODELS } from "@deco/sdk";
import { DecoChatModelSelectorRich } from "@deco/ui/components/deco-chat-model-selector-rich.tsx";
import { useMemo } from "react";

const mapLegacyModelId = (modelId: string): string => {
  const model = WELL_KNOWN_MODELS.find((m) => m.legacyId === modelId);
  return model ? model.id : modelId;
};

interface ModelSelectorProps {
  model?: string;
  onModelChange?: (model: string) => void;
  variant?: "borderless" | "bordered";
  className?: string;
}

export function ModelSelector({
  model = DEFAULT_MODEL.id,
  onModelChange,
  variant = "borderless",
  className,
}: ModelSelectorProps) {
  const { data: models } = useModels({ excludeDisabled: true });

  const handleModelChange = (modelId: string) => {
    if (onModelChange) {
      onModelChange(modelId);
    }
  };

  // Map SDK models to UI ModelInfo
  const uiModels = useMemo(
    () =>
      models.map((m) => ({
        id: m.id,
        name: m.name,
        logo: m.logo,
        description: m.description,
        capabilities: m.capabilities,
        contextWindow: m.contextWindow,
        inputCost: m.inputCost,
        outputCost: m.outputCost,
        outputLimit: m.outputLimit,
        provider: m.provider,
      })),
    [models],
  );

  const currentModelId = mapLegacyModelId(model);

  return (
    <DecoChatModelSelectorRich
      models={uiModels}
      selectedModelId={currentModelId}
      onModelChange={handleModelChange}
      variant={variant}
      className={className}
    />
  );
}
