import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select.tsx";
import { Badge } from "./badge.tsx";
import { cn } from "../lib/utils.ts";

export interface ModelInfo {
  id: string;
  model: string;
  name: string;
  logo?: string | null;
  description?: string | null;
  capabilities?: string[];
}

interface DecoChatModelSelectorProps {
  models: ModelInfo[];
  selectedModel?: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  placeholder?: string;
}

export function DecoChatModelSelector({
  models,
  selectedModel,
  onModelChange,
  disabled,
  isLoading,
  className,
  placeholder = "Select model",
}: DecoChatModelSelectorProps) {
  return (
    <Select
      value={selectedModel}
      onValueChange={onModelChange}
      disabled={disabled || isLoading || models.length === 0}
    >
      <SelectTrigger className={cn("h-8 w-48 text-xs", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.model}>
            <div className="flex items-center gap-2">
              {model.logo && (
                <img
                  src={model.logo}
                  alt={model.name}
                  className="size-4 rounded"
                />
              )}
              <span>{model.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface DecoChatModelBadgeProps {
  model?: ModelInfo;
  className?: string;
}

export function DecoChatModelBadge({
  model,
  className,
}: DecoChatModelBadgeProps) {
  if (!model) return null;

  return (
    <Badge variant="secondary" className={cn("text-xs font-normal", className)}>
      <div className="flex items-center gap-1.5">
        {model.logo && (
          <img src={model.logo} alt={model.name} className="size-3 rounded" />
        )}
        <span>{model.name}</span>
      </div>
    </Badge>
  );
}
