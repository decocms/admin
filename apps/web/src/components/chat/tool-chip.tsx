import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { IntegrationIcon } from "../integrations/common.tsx";

interface ToolChipProps {
  name: string;
  icon?: string;
  onRemove: () => void;
  className?: string;
}

export function ToolChip({ name, icon, onRemove, className }: ToolChipProps) {
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium",
        className
      )}
    >
      <IntegrationIcon icon={icon} className="w-4 h-4" />
      <span className="text-gray-700">{name}</span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 hover:bg-gray-200 rounded-full transition-colors"
        type="button"
      >
        <Icon name="close" size={12} className="text-gray-500" />
      </button>
    </div>
  );
} 