import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@deco/ui/components/drawer.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { DEFAULT_REASONING_MODEL, MODELS } from "@deco/sdk";
import { useState } from "react";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";

const mapLegacyModelId = (modelId: string): string => {
  const model = MODELS.find((m) => m.legacyId === modelId);
  return model ? model.id : modelId;
};

const CAPABILITY_CONFIGS = {
  "reasoning": {
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

function CapabilityBadge(
  { capability }: { capability: keyof typeof CAPABILITY_CONFIGS },
) {
  const config = CAPABILITY_CONFIGS[capability] || {
    icon: "check",
    bg: "bg-slate-200",
    text: "text-slate-700",
    label: capability,
  };

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
}

function ModelItemContent({ model }: { model: typeof MODELS[0] }) {
  return (
    <div className="p-2 w-[400px] flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <img src={model.logo} className="w-5 h-5" />
        <span className="text-normal">{model.name}</span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {model.capabilities.map((capability) => (
          <CapabilityBadge key={capability} capability={capability} />
        ))}
      </div>
    </div>
  );
}

function SelectedModelDisplay(
  { model, loading }: { model: typeof MODELS[0]; loading?: boolean },
) {
  return (
    <div className="flex items-center gap-1.5">
      <img src={model.logo} className="w-3 h-3" />
      <span className="text-xs">{model.name}</span>
      {loading && <Spinner size="xs" />}
    </div>
  );
}

interface ModelSelectorProps {
  model?: string;
  onModelChange?: (model: string) => Promise<void>;
}

export function ModelSelector({
  model = DEFAULT_REASONING_MODEL,
  onModelChange,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const isMobile = useIsMobile();
  const selectedModel = MODELS.find((m) => m.id === model) || MODELS[0];

  const handleModelChange = (model: string) => {
    if (onModelChange) {
      setModelLoading(true);
      onModelChange(model).finally(() => {
        setModelLoading(false);
      });
      setOpen(false);
    }
  };

  const triggerClassName = cn(
    "!h-8 text-xs border hover:bg-slate-100 py-0 rounded-full px-2 shadow-none",
    modelLoading && "opacity-50 cursor-not-allowed",
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline" className={triggerClassName}>
            <SelectedModelDisplay
              model={selectedModel}
              loading={modelLoading}
            />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="hidden">
            <DrawerTitle className="text-center">
              Select agent model
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 p-2 py-4">
            {MODELS.map((model) => (
              <Button
                key={model.id}
                variant="ghost"
                className={cn(
                  "p-0 focus:bg-slate-100 focus:text-foreground",
                  model.id === selectedModel?.id && "bg-slate-50",
                )}
                onClick={() => handleModelChange(model.id)}
              >
                <ModelItemContent model={model} />
              </Button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={mapLegacyModelId(model)}
      onValueChange={(value) => handleModelChange(value)}
      disabled={modelLoading}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder="Select model">
          <SelectedModelDisplay model={selectedModel} loading={modelLoading} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[400px]">
        {MODELS.map((model) => (
          <SelectItem
            hideCheck
            key={model.id}
            value={model.id}
            className={cn(
              "p-0 focus:bg-slate-100 focus:text-foreground",
              model.id === selectedModel?.id && "bg-slate-50",
            )}
          >
            <ModelItemContent model={model} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
