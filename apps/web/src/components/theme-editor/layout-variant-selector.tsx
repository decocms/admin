import { Label } from "@deco/ui/components/label.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

interface VariantOption {
  label: string;
  value: string;
  description?: string;
}

interface LayoutVariantSelectorProps {
  label: string;
  description?: string;
  value: string;
  options: VariantOption[];
  onChange: (value: string) => void;
}

export function LayoutVariantSelector({
  label,
  description,
  value,
  options,
  onChange,
}: LayoutVariantSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-semibold">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-start justify-center h-auto py-3 px-3 transition-all",
              value === option.value && "ring-2 ring-ring ring-offset-2",
            )}
          >
            <span className="text-xs font-semibold">{option.label}</span>
            {option.description && (
              <span className="text-[10px] text-muted-foreground mt-0.5 font-normal">
                {option.description}
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
