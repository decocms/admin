import { RegistryItemCard } from "./registry-item-card";
import type { MCPRegistryServer } from "./registry-item-card";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RegistryItem = any;

interface RegistryItemsSectionProps {
  items: RegistryItem[] | MCPRegistryServer[];
  title: string;
  subtitle?: string;
  onItemClick: (item: RegistryItem | MCPRegistryServer) => void;
}

export function RegistryItemsSection({
  items,
  title,
  subtitle,
  onItemClick,
}: RegistryItemsSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <RegistryItemCard
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </div>
  );
}
