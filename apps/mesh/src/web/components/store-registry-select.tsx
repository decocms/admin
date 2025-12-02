import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@deco/ui/components/select.tsx";
import { Plus } from "lucide-react";

interface Registry {
  id: string;
  name: string;
  icon?: string;
}

interface StoreRegistrySelectProps {
  registries?: Registry[];
  value?: string;
  onValueChange?: (value: string) => void;
  onAddNew?: () => void;
  placeholder?: string;
}

export function StoreRegistrySelect({
  registries = [],
  value,
  onValueChange,
  onAddNew,
  placeholder = "Select store...",
}: StoreRegistrySelectProps) {
  const handleValueChange = (newValue: string) => {
    if (newValue === "__add_new__") {
      onAddNew?.();
    } else {
      onValueChange?.(newValue);
    }
  };

  return (
    <Select value={value || ""} onValueChange={handleValueChange}>
      <SelectTrigger className="w-[146px] h-8! rounded-lg">
        <SelectValue
          placeholder={
            <span className="flex items-center gap-2">
              {placeholder}
            </span>
          }
        />
      </SelectTrigger>
      <SelectContent>
        {registries.length === 0 ? (
          <>
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No stores available
            </div>
            {onAddNew && (
              <>
                <SelectSeparator />
                <SelectItem value="__add_new__" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Plus size={16} className="text-primary" />
                    <span>Add new registry</span>
                  </div>
                </SelectItem>
              </>
            )}
          </>
        ) : (
          <>
            {registries.map((registry) => (
              <SelectItem
                key={registry.id}
                value={registry.id}
                className="flex items-center gap-2"
              >
                <div className="flex items-center gap-2 w-full">
                  {registry.icon && (
                    <div className="h-5 w-5 rounded flex items-center justify-center bg-muted/20 overflow-hidden">
                      {registry.icon.startsWith("http") ||
                      registry.icon.startsWith("/") ? (
                        <img
                          src={registry.icon}
                          alt={registry.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Icon name={registry.icon as any} size={16} />
                      )}
                    </div>
                  )}
                  <span className="truncate">{registry.name}</span>
                </div>
              </SelectItem>
            ))}
            {onAddNew && (
              <>
                <SelectSeparator />
                <SelectItem value="__add_new__" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Plus size={16} className="text-primary" />
                    <span>Add new registry</span>
                  </div>
                </SelectItem>
              </>
            )}
          </>
        )}
      </SelectContent>
    </Select>
  );
}

