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

// Helper function to map legacy model IDs to new ones
const mapLegacyModelId = (modelId: string): string => {
  const model = MODELS.find((m) => m.legacyId === modelId);
  return model ? model.id : modelId;
};

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

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "!h-8 text-xs border hover:bg-slate-100 py-0 rounded-full px-2 shadow-none",
              modelLoading && "opacity-50 cursor-not-allowed",
            )}
          >
            <div className="flex items-center gap-1.5">
              <img src={selectedModel.logo} className="w-3 h-3" />
              <span className="text-xs">
                {selectedModel.name}
              </span>
            </div>
            {modelLoading && <Spinner size="xs" />}
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
                <div className="p-2 w-[400px] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <img src={model.logo} className="w-5 h-5" />
                    <span className="text-normal">{model.name}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {model.capabilities.map((capability) => {
                      const iconMap = {
                        "reasoning": "neurology",
                        "image-upload": "image",
                        "file-upload": "description",
                        "web-search": "search",
                      };

                      const colorMap = {
                        "reasoning": {
                          bg: "bg-purple-100",
                          text: "text-purple-700",
                        },
                        "image-upload": {
                          bg: "bg-teal-100",
                          text: "text-teal-700",
                        },
                        "file-upload": {
                          bg: "bg-blue-100",
                          text: "text-blue-700",
                        },
                        "web-search": {
                          bg: "bg-amber-100",
                          text: "text-amber-700",
                        },
                      };

                      const labelMap = {
                        "reasoning": "Reasoning",
                        "image-upload": "Can analyze images",
                        "file-upload": "Can analyze files",
                        "web-search": "Can search the web to answer questions",
                      };

                      const colors = colorMap[capability] ||
                        {
                          bg: "bg-slate-200",
                          text: "text-slate-700",
                        };

                      return (
                        <Tooltip key={capability}>
                          <TooltipTrigger asChild>
                            <div
                              className={`flex items-center justify-center h-6 w-6 rounded-sm ${colors.bg}`}
                            >
                              <Icon
                                name={iconMap[capability] || "check"}
                                className={colors.text}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {labelMap[capability] || capability}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
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
      onValueChange={(value) => {
        if (onModelChange) {
          setModelLoading(true);
          onModelChange(value).finally(() => {
            setModelLoading(false);
          });
        }
      }}
      disabled={modelLoading}
    >
      <SelectTrigger
        className={cn(
          "!h-8 text-xs border hover:bg-slate-100 py-0 rounded-full px-2 shadow-none",
          modelLoading && "opacity-50 cursor-not-allowed",
        )}
      >
        <SelectValue placeholder="Select model">
          <div className="flex items-center gap-1.5">
            <img src={selectedModel.logo} className="w-3 h-3" />
            <span className="text-xs">
              {selectedModel.name}
            </span>
          </div>
        </SelectValue>
        {modelLoading && <Spinner size="xs" />}
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
            <div className="p-2 w-[400px] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <img src={model.logo} className="w-5 h-5" />
                <span className="text-normal">{model.name}</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {model.capabilities.map((capability) => {
                  const iconMap = {
                    "reasoning": "neurology",
                    "image-upload": "image",
                    "file-upload": "description",
                    "web-search": "search",
                  };

                  const colorMap = {
                    "reasoning": {
                      bg: "bg-purple-100",
                      text: "text-purple-700",
                    },
                    "image-upload": {
                      bg: "bg-teal-100",
                      text: "text-teal-700",
                    },
                    "file-upload": {
                      bg: "bg-blue-100",
                      text: "text-blue-700",
                    },
                    "web-search": {
                      bg: "bg-amber-100",
                      text: "text-amber-700",
                    },
                  };

                  const labelMap = {
                    "reasoning": "Reasoning",
                    "image-upload": "Can analyze images",
                    "file-upload": "Can analyze files",
                    "web-search": "Can search the web to answer questions",
                  };

                  const colors = colorMap[capability] ||
                    {
                      bg: "bg-slate-200",
                      text: "text-slate-700",
                    };

                  return (
                    <Tooltip key={capability}>
                      <TooltipTrigger asChild>
                        <div
                          className={`flex items-center justify-center h-6 w-6 rounded-sm ${colors.bg}`}
                        >
                          <Icon
                            name={iconMap[capability] || "check"}
                            className={colors.text}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {labelMap[capability] || capability}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
