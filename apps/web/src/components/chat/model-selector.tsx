import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  ResponsiveSelect,
  ResponsiveSelectContent,
  ResponsiveSelectTrigger,
  ResponsiveSelectValue,
} from "@deco/ui/components/responsive-select.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  DEFAULT_MODEL,
  type Model,
  useModels,
  WELL_KNOWN_MODELS,
} from "@deco/sdk";
import { memo, useMemo, useState } from "react";

const mapLegacyModelId = (modelId: string): string => {
  const model = WELL_KNOWN_MODELS.find((m) => m.legacyId === modelId);
  return model ? model.id : modelId;
};

const CAPABILITY_CONFIGS = {
  reasoning: {
    icon: "neurology",
    bg: "bg-purple-100",
    text: "text-purple-700",
    label: "Reasoning",
  },
  "image-upload": {
    icon: "image",
    bg: "bg-teal-100",
    text: "text-teal-700",
    label: "Can analyze images",
  },
  "file-upload": {
    icon: "description",
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "Can analyze files",
  },
  "web-search": {
    icon: "search",
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Can search the web to answer questions",
  },
} as const;

const CapabilityBadge = memo(function CapabilityBadge({
  capability,
}: {
  capability: keyof typeof CAPABILITY_CONFIGS;
}) {
  const config = useMemo(() => {
    return (
      CAPABILITY_CONFIGS[capability] || {
        icon: "check" as const,
        bg: "bg-slate-200" as const,
        text: "text-slate-700" as const,
        label: capability,
      }
    );
  }, [capability]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center justify-center h-6 w-6 rounded-sm ${config.bg}`}
        >
          <Icon name={config.icon} className={config.text} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.label}</p>
      </TooltipContent>
    </Tooltip>
  );
});

const ModelDetailsPanel = memo(function ModelDetailsPanel({
  model,
}: {
  model: Model | null;
}) {
  if (!model) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Hover to preview
      </div>
    );
  }

  const hasDetails =
    model.contextWindow ||
    model.inputCost ||
    model.outputCost ||
    model.outputLimit;

  if (!hasDetails) {
    return (
      <div className="flex flex-col gap-3 py-1 px-1.5">
        <div className="flex items-center gap-3 py-2 px-0">
          <img src={model.logo} className="w-6 h-6" />
          <p className="text-lg font-medium leading-7">{model.name}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          No additional details available
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-1 px-1.5">
      <div className="flex flex-col gap-3 py-2 px-0">
        <div className="flex items-center gap-3">
          <img src={model.logo} className="w-6 h-6" />
          <p className="text-lg font-medium leading-7">{model.name}</p>
        </div>
        {model.capabilities && model.capabilities.length > 0 && (
          <div className="flex items-center gap-2">
            {model.capabilities.map((capability) => (
              <CapabilityBadge key={capability} capability={capability} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {model.contextWindow && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Icon
                name="widgets"
                className="w-3.5 h-3.5 text-muted-foreground"
              />
              <p className="text-sm text-foreground">Context window</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {model.contextWindow.toLocaleString()} tokens
            </p>
          </div>
        )}

        {(model.inputCost || model.outputCost) && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Icon
                name="attach_money"
                className="w-3.5 h-3.5 text-muted-foreground"
              />
              <p className="text-sm text-foreground">Costs</p>
            </div>
            <div className="flex flex-col gap-0.5">
              {model.inputCost && (
                <p className="text-sm text-muted-foreground">
                  ${model.inputCost.toFixed(2)} / 1M tokens (input)
                </p>
              )}
              {model.outputCost && (
                <p className="text-sm text-muted-foreground">
                  ${model.outputCost.toFixed(2)} / 1M tokens (output)
                </p>
              )}
            </div>
          </div>
        )}

        {model.outputLimit && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Icon
                name="output"
                className="w-4.5 h-4.5 text-muted-foreground/70"
              />
              <p className="text-sm text-foreground">Output limit</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {model.outputLimit.toLocaleString()} token limit
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

const ModelItemContent = memo(function ModelItemContent({
  model,
  onHover,
  isSelected,
}: {
  model: Model;
  onHover: (model: Model) => void;
  isSelected?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 h-10 py-4 px-3 hover:bg-accent cursor-pointer rounded-xl"
      onMouseEnter={() => onHover(model)}
    >
      <img src={model.logo} className="w-5 h-5" />
      <span className="text-sm text-foreground">{model.name}</span>
      {isSelected && (
        <Icon name="check" className="w-4 h-4 text-foreground ml-auto" />
      )}
    </div>
  );
});

function SelectedModelDisplay({
  model,
}: {
  model: (typeof WELL_KNOWN_MODELS)[0];
}) {
  return (
    <div className="flex items-center gap-2">
      {model.logo && <img src={model.logo} className="w-4 h-4" />}
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
        {model.name}
      </span>
    </div>
  );
}

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
  const [open, setOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<Model | null>(null);
  const { data: models } = useModels({ excludeDisabled: true });
  const selectedModel = models.find((m) => m.id === model) || DEFAULT_MODEL;

  const handleModelChange = (model: string) => {
    if (onModelChange) {
      onModelChange(model);
      setOpen(false);
    }
  };

  return (
    <ResponsiveSelect
      open={open}
      onOpenChange={setOpen}
      value={mapLegacyModelId(model)}
      onValueChange={(value) => handleModelChange(value)}
    >
      <ResponsiveSelectTrigger
        className={cn(
          "h-8! text-sm hover:bg-accent rounded-lg py-1 px-2 gap-1 shadow-none cursor-pointer border-0 group focus-visible:ring-0 focus-visible:ring-offset-0",
          variant === "borderless" && "md:border-none",
          className,
        )}
      >
        <ResponsiveSelectValue placeholder="Select model">
          <SelectedModelDisplay model={selectedModel} />
        </ResponsiveSelectValue>
      </ResponsiveSelectTrigger>
      <ResponsiveSelectContent
        title="Select model"
        className="w-auto min-w-[600px] [&_button[aria-label='Scroll down']]:!hidden [&_button[aria-label='Scroll up']]:!hidden"
      >
        <div className="flex h-[350px]">
          {/* Left column - model list */}
          <div className="flex-1 overflow-y-auto px-0.5 border-r">
            {models.map((m) => (
              <div
                key={m.id}
                onClick={() => handleModelChange(m.id)}
                className={cn(
                  "rounded-xl",
                  m.id === selectedModel?.id && "bg-accent",
                )}
              >
                <ModelItemContent
                  model={m}
                  onHover={setHoveredModel}
                  isSelected={m.id === selectedModel?.id}
                />
              </div>
            ))}
          </div>

          {/* Right column - details panel */}
          <div className="w-[300px] p-3">
            <ModelDetailsPanel model={hoveredModel || selectedModel} />
          </div>
        </div>
      </ResponsiveSelectContent>
    </ResponsiveSelect>
  );
}
