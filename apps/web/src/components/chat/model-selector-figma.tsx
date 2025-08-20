import { useModels } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";

interface OpenRouterModelInfo {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
  };
  context_length?: number;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: {
    prompt_tokens?: string;
    completion_tokens?: string;
  };
}

interface ModelSelectorFigmaProps {
  model?: string;
  onModelChange?: (model: string) => void;
  variant?: "default" | "borderless" | "bordered";
}

const DEFAULT_MODEL = {
  id: "anthropic/claude-3.5-sonnet",
  model: "anthropic/claude-3.5-sonnet",
  name: "Claude 3.5 Sonnet",
  logo: "https://assets.decocache.com/webdraw/6ae2b0e1-7b81-48f7-9707-998751698b6f/anthropic.svg",
  capabilities: [],
  byDeco: false,
  isEnabled: true,
  hasCustomKey: false,
};

function formatPrice(price?: string | number): string {
  if (!price && price !== 0) return "N/A";
  
  // Handle if price is already a number
  const num = typeof price === 'number' ? price : parseFloat(price);
  if (isNaN(num)) return "N/A";
  
  // Price is already per 1M tokens in OpenRouter
  if (num < 0.01) {
    return `$${num.toFixed(4)} / 1M tokens`;
  } else if (num < 1) {
    return `$${num.toFixed(3)} / 1M tokens`;
  } else {
    return `$${num.toFixed(2)} / 1M tokens`;
  }
}

function formatContextLength(length?: number): string {
  if (!length) return "N/A";
  
  if (length >= 1000000) {
    return `${(length / 1000000).toFixed(1)}M tokens`;
  } else if (length >= 1000) {
    return `${(length / 1000).toFixed(0)}K tokens`;
  } else {
    return `${length} tokens`;
  }
}

function ModelCapabilityBadge({ capability }: { capability: string }) {
  const iconMap: Record<string, string> = {
    "web": "globe",
    "reasoning": "brain",
    "vision": "image",
    "image-upload": "image",
    "function": "functions",
    "json": "code",
    "file-upload": "file_spreadsheet",
    "spreadsheet": "file_spreadsheet",
  };
  
  return (
    <div className="bg-purple-light/30 p-0.5 rounded-md">
      <Icon 
        name={iconMap[capability] || "circle"} 
        size={16} 
        className="text-purple-light"
      />
    </div>
  );
}

// Model logo component that handles both URLs and fallback icons
function ModelLogo({ model, size = 16 }: { model: any; size?: number }) {
  if (model.logo && model.logo.startsWith('http')) {
    return (
      <img 
        src={model.logo} 
        alt={model.name}
        className={`shrink-0`}
        style={{ width: size, height: size }}
      />
    );
  }
  
  // Fallback to icon if no logo URL
  const modelName = model.name?.toLowerCase() || model.model?.toLowerCase() || "";
  let iconName = "smart_toy";
  
  if (modelName.includes("claude")) {
    iconName = "smart_toy";
  } else if (modelName.includes("gpt") || modelName.includes("openai")) {
    iconName = "robot_2";
  } else if (modelName.includes("gemini") || modelName.includes("google")) {
    iconName = "star";
  } else if (modelName.includes("grok") || modelName.includes("xai")) {
    iconName = "auto_awesome";
  } else if (modelName.includes("deepseek")) {
    iconName = "search";
  }
  
  return <Icon name={iconName} size={size} className="text-foreground shrink-0" />;
}

export function ModelSelectorFigma({
  model: selectedModelId,
  onModelChange,
  variant = "bordered"
}: ModelSelectorFigmaProps) {
  const [open, setOpen] = useState(false);
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModelInfo[]>([]);
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] = useState(false);
  const { data: models } = useModels({ excludeDisabled: true });

  useEffect(() => {
    if (open && openRouterModels.length === 0 && !isLoadingOpenRouterModels) {
      setIsLoadingOpenRouterModels(true);
      
      // Fetch from our API proxy endpoint
      fetch("/api/openrouter/models")
        .then((res) => res.json())
        .then((data) => {
          if (data?.data) {
            setOpenRouterModels(data.data);
          }
        })
        .catch((error) => {
          // Fallback to direct OpenRouter API if proxy fails
          return fetch("https://openrouter.ai/api/v1/models")
            .then((res) => res.json())
            .then((data) => {
              if (data?.data) {
                setOpenRouterModels(data.data);
              }
            });
        })
        .catch((error) => {
          console.error("Failed to fetch OpenRouter models:", error);
        })
        .finally(() => {
          setIsLoadingOpenRouterModels(false);
        });
    }
  }, [open, openRouterModels.length, isLoadingOpenRouterModels]);

  const selectedModel = useMemo(
    () => models?.find((m) => m.id === selectedModelId) || DEFAULT_MODEL,
    [models, selectedModelId]
  );

  const hoveredModel = useMemo(
    () => models?.find((m) => m.id === hoveredModelId),
    [models, hoveredModelId]
  );

  // Map our model IDs to OpenRouter model IDs
  const getOpenRouterModelId = (model: any) => {
    // Remove the provider prefix and convert format
    const modelId = model.model || model.id;
    
    // Handle special cases
    if (modelId.includes("claude-3.7-sonnet:thinking")) {
      return "anthropic/claude-3.5-sonnet-20241022";
    }
    if (modelId.includes("claude-sonnet-4")) {
      return "anthropic/claude-3.5-sonnet-20241022";
    }
    if (modelId.includes("gpt-4.1-mini")) {
      return "openai/gpt-4o-mini";
    }
    if (modelId.includes("gpt-4.1-nano")) {
      return "openai/gpt-4o-mini";
    }
    if (modelId.includes("gpt-4.1")) {
      return "openai/gpt-4o";
    }
    if (modelId.includes("gpt-oss")) {
      return "openai/gpt-4o";
    }
    if (modelId.includes("o3-mini")) {
      return "openai/o1-mini";
    }
    if (modelId.includes("gemini")) {
      if (modelId.includes("flash")) {
        return "google/gemini-flash-1.5";
      }
      return "google/gemini-pro-1.5";
    }
    if (modelId.includes("grok")) {
      return "x-ai/grok-2";
    }
    
    // Default: try to convert format
    return modelId.replace(":", "/");
  };

  const hoveredOpenRouterModel = useMemo(() => {
    if (!hoveredModel) return null;
    const openRouterId = getOpenRouterModelId(hoveredModel);
    return openRouterModels.find((orm) => orm.id === openRouterId);
  }, [openRouterModels, hoveredModel]);

  const triggerClasses = cn(
    "flex items-center justify-between px-3 py-1.5 rounded-xl w-full min-w-[200px] transition-colors",
    variant === "bordered" && "border border-border",
    variant === "borderless" && "hover:bg-accent",
    variant === "default" && "border border-border hover:bg-accent"
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className={triggerClasses}>
          <div className="flex items-center gap-2">
            <ModelLogo model={selectedModel} size={16} />
            <span className="text-sm text-foreground font-normal">
              {selectedModel.name}
            </span>
          </div>
          <Icon 
            name="chevron_down" 
            size={18} 
            className="text-muted-foreground"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        sideOffset={8}
        className="p-0 w-auto border-border bg-background"
      >
        <div className="flex">
          {/* Model List */}
          <div className="min-w-[260px] max-h-[400px] overflow-y-auto py-2">
            {models?.map((model) => (
              <DropdownMenuItem
                key={model.id}
                className={cn(
                  "px-3 py-1.5 rounded-lg cursor-pointer mx-2 transition-colors",
                  "focus:bg-transparent hover:bg-muted/50",
                  hoveredModelId === model.id && "bg-muted/50"
                )}
                onMouseEnter={() => setHoveredModelId(model.id)}
                onMouseLeave={() => setHoveredModelId(null)}
                onSelect={() => {
                  onModelChange?.(model.id);
                  setOpen(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <ModelLogo model={model} size={16} />
                  <span className="text-sm text-foreground whitespace-nowrap pr-2">
                    {model.name}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </div>

          {/* Details Panel - Shows on hover */}
          {hoveredModel && (
            <div className="w-[233px] border-l border-border p-3 bg-background animate-in fade-in-0 slide-in-from-left-1 duration-200">
              <div className="flex flex-col h-full justify-between">
                {/* Model Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <ModelLogo model={hoveredModel} size={16} />
                    <span className="text-sm text-foreground">
                      {hoveredModel.name}
                    </span>
                  </div>

                  {/* Capabilities */}
                  {hoveredModel.capabilities && hoveredModel.capabilities.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {hoveredModel.capabilities.map((cap) => (
                        <ModelCapabilityBadge key={cap} capability={cap} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Pricing & Stats */}
                <div className="space-y-3 mt-4">
                  {isLoadingOpenRouterModels ? (
                    <>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </>
                  ) : hoveredOpenRouterModel ? (
                    <>
                      {/* Output Cost */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <Icon 
                            name="attach_money" 
                            size={16} 
                            className="text-muted-foreground"
                          />
                          <span className="text-xs text-foreground">Output cost</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatPrice(hoveredOpenRouterModel.pricing?.completion)}
                        </span>
                      </div>

                      {/* Context Window */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <Icon 
                            name="container" 
                            size={16} 
                            className="text-muted-foreground"
                          />
                          <span className="text-xs text-foreground">Context window</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatContextLength(hoveredOpenRouterModel.context_length)}
                        </span>
                      </div>

                      {/* Output Limit */}
                      {hoveredOpenRouterModel.top_provider?.max_completion_tokens && (
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-1.5">
                            <Icon 
                              name="corner_down_right" 
                              size={16} 
                              className="text-muted-foreground"
                            />
                            <span className="text-xs text-foreground">Output</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatContextLength(hoveredOpenRouterModel.top_provider.max_completion_tokens)} limit
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Model information unavailable
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}