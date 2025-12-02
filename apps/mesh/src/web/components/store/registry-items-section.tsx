import { RegistryItemCard } from "./registry-item-card";

export interface RegistryItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface RegistryItemsSectionProps {
  items: RegistryItem[];
  title: string;
  subtitle?: string;
  onItemClick: (item: RegistryItem) => void;
}

export function RegistryItemsSection({
  items,
  title,
  subtitle,
  onItemClick,
}: RegistryItemsSectionProps) {
  if (items.length === 0) {
    return null;
  }

  console.log(items);
  console.log(title, subtitle);
  console.log(onItemClick);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <RegistryItemCard
            key={item.id}
            {...item}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </div>
  );
}

