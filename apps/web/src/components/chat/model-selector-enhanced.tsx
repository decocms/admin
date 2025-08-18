import { useState, useEffect } from "react";
import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useModels } from "@deco/sdk";
import type { Model } from "@deco/sdk";

interface OpenRouterModelInfo {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
}

interface ModelSelectorEnhancedProps {
  model?: string;
  onModelChange?: (model: string) => void;
  variant?: "borderless" | "default";
}

// Fetch OpenRouter model information
async function fetchOpenRouterModels(): Promise<OpenRouterModelInfo[]> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Failed to fetch OpenRouter models:", error);
    return [];
  }
}

function formatPrice(price: string | undefined): string {
  if (!price) return "N/A";
  const priceNum = parseFloat(price);
  if (priceNum === 0) return "Free";
  // Convert to price per 1M tokens
  const pricePerMillion = priceNum * 1000000;
  return `$${pricePerMillion.toFixed(2)}/1M`;
}

function formatContextLength(length: number | undefined): string {
  if (!length) return "N/A";
  if (length >= 1000000) {
    return `${(length / 1000000).toFixed(1)}M`;
  }
  if (length >= 1000) {
    return `${(length / 1000).toFixed(0)}K`;
  }
  return length.toString();
}

function ModelCard({ 
  model, 
  openRouterInfo, 
  isSelected,
  onClick 
}: { 
  model: Model;
  openRouterInfo?: OpenRouterModelInfo;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasInfo = !!openRouterInfo;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        "hover:bg-accent/50",
        isSelected ? "border-primary bg-accent" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Model Logo */}
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          {model.logo ? (
            <img src={model.logo} alt={model.name} className="w-6 h-6" />
          ) : (
            <Icon name="smart_toy" size={20} className="text-muted-foreground" />
          )}
        </div>
        
        {/* Model Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-foreground truncate">
              {model.name}
            </h4>
            {model.byDeco && (
              <Badge variant="secondary" className="text-xs">By Deco</Badge>
            )}
          </div>
          
          {hasInfo && openRouterInfo.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {openRouterInfo.description}
            </p>
          )}
          
          {/* Capabilities */}
          <div className="flex flex-wrap gap-1 mt-2">
            {model.capabilities?.map((cap) => (
              <Badge key={cap} variant="outline" className="text-xs px-1.5 py-0">
                {cap}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Price and Context Info */}
        {hasInfo && (
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Icon name="attach_money" size={12} />
              <span>{formatPrice(openRouterInfo.pricing?.prompt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Icon name="description" size={12} />
              <span>{formatContextLength(openRouterInfo.context_length)}</span>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

function ModelDetails({ 
  model, 
  openRouterInfo 
}: { 
  model: Model;
  openRouterInfo?: OpenRouterModelInfo;
}) {
  if (!openRouterInfo) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No additional information available</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-lg">{model.name}</h3>
        {openRouterInfo.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {openRouterInfo.description}
          </p>
        )}
      </div>
      
      {/* Pricing */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Pricing</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Input</p>
            <p className="font-medium text-sm">
              {formatPrice(openRouterInfo.pricing?.prompt)}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Output</p>
            <p className="font-medium text-sm">
              {formatPrice(openRouterInfo.pricing?.completion)}
            </p>
          </div>
        </div>
      </div>
      
      {/* Technical Specs */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Specifications</h4>
        <div className="space-y-2">
          <div className="flex justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Context Length</span>
            <span className="text-sm font-medium">
              {formatContextLength(openRouterInfo.context_length)} tokens
            </span>
          </div>
          {openRouterInfo.top_provider?.max_completion_tokens && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Max Output</span>
              <span className="text-sm font-medium">
                {formatContextLength(openRouterInfo.top_provider.max_completion_tokens)} tokens
              </span>
            </div>
          )}
          {openRouterInfo.architecture?.modality && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Modality</span>
              <span className="text-sm font-medium">
                {openRouterInfo.architecture.modality}
              </span>
            </div>
          )}
          {openRouterInfo.architecture?.instruct_type && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Instruct Type</span>
              <span className="text-sm font-medium">
                {openRouterInfo.architecture.instruct_type}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Capabilities */}
      {model.capabilities && model.capabilities.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Capabilities</h4>
          <div className="flex flex-wrap gap-2">
            {model.capabilities.map((cap) => (
              <Badge key={cap} variant="secondary">
                {cap.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ModelSelectorEnhanced({
  model: selectedModelId,
  onModelChange,
  variant = "default",
}: ModelSelectorEnhancedProps) {
  const [open, setOpen] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModelInfo[]>([]);
  const [loadingOpenRouter, setLoadingOpenRouter] = useState(false);
  const { data: models } = useModels({ excludeDisabled: true });
  
  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0];
  const [detailsModel, setDetailsModel] = useState<Model>(selectedModel);
  
  // Fetch OpenRouter models when dialog opens
  useEffect(() => {
    if (open && openRouterModels.length === 0) {
      setLoadingOpenRouter(true);
      fetchOpenRouterModels().then((data) => {
        setOpenRouterModels(data);
        setLoadingOpenRouter(false);
      });
    }
  }, [open]);
  
  // Update details model when selection changes
  useEffect(() => {
    setDetailsModel(selectedModel);
  }, [selectedModel]);
  
  const handleModelSelect = (model: Model) => {
    if (onModelChange) {
      onModelChange(model.id);
      setOpen(false);
    }
  };
  
  const getOpenRouterInfo = (modelId: string): OpenRouterModelInfo | undefined => {
    // Map internal model IDs to OpenRouter IDs
    const mappedId = modelId.replace(":", "/");
    return openRouterModels.find(m => 
      m.id === mappedId || 
      m.id.includes(modelId) || 
      modelId.includes(m.id.split("/")[1])
    );
  };
  
  return (
    <>
      <Button
        variant={variant === "borderless" ? "ghost" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "h-9 text-xs px-3",
          variant === "borderless" && "border-none shadow-none",
        )}
      >
        <div className="flex items-center gap-2">
          {selectedModel.logo ? (
            <img src={selectedModel.logo} alt="" className="w-4 h-4" />
          ) : (
            <Icon name="smart_toy" size={16} />
          )}
          <span className="font-medium">{selectedModel.name}</span>
          <Icon name="expand_more" size={16} className="ml-1" />
        </div>
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl h-[80vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Select Model</DialogTitle>
          </DialogHeader>
          
          <div className="flex h-full">
            {/* Models List */}
            <div className="w-1/2 border-r">
              <ScrollArea className="h-[calc(80vh-73px)]">
                <div className="p-4 space-y-2">
                  {loadingOpenRouter ? (
                    <>
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </>
                  ) : (
                    models.map((model) => (
                      <ModelCard
                        key={model.id}
                        model={model}
                        openRouterInfo={getOpenRouterInfo(model.id)}
                        isSelected={model.id === selectedModel.id}
                        onClick={() => {
                          setDetailsModel(model);
                          handleModelSelect(model);
                        }}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            
            {/* Model Details */}
            <div className="w-1/2">
              <ScrollArea className="h-[calc(80vh-73px)]">
                <div className="p-6">
                  <ModelDetails 
                    model={detailsModel} 
                    openRouterInfo={getOpenRouterInfo(detailsModel.id)}
                  />
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
