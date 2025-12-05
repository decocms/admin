import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface Registry {
  id: string;
  name: string;
  icon?: string;
}

interface StoreRegistrySelectProps {
  registries: Registry[];
  value: string;
  onValueChange: (value: string) => void;
  onAddNew: () => void;
  placeholder?: string;
}

export function StoreRegistrySelect({
  registries,
  value,
  onValueChange,
  onAddNew,
  placeholder = "Select a registry...",
}: StoreRegistrySelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[200px] h-8!">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {registries.map((registry) => (
          <SelectItem key={registry.id} value={registry.id}>
            <div className="flex items-center gap-2">
              {registry.icon ? (
                <img
                  src={registry.icon}
                  alt={registry.name}
                  className="w-4 h-4 rounded"
                />
              ) : (
                <div className="w-4 h-4 rounded from-primary/20 to-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {registry.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span>{registry.name}</span>
            </div>
          </SelectItem>
        ))}
        <div className="border-t border-border">
          <button
            onClick={onAddNew}
            className="w-full flex items-center gap-2 px-2 py-2 hover:bg-muted rounded-md text-sm cursor-pointer"
          >
            <Icon name="add" size={16} />
            <span>Create connection</span>
          </button>
        </div>
      </SelectContent>
    </Select>
  );
}
