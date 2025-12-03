import { RegistryItemCard } from "./registry-item-card";
import type { MCPRegistryServerMeta } from "./registry-item-card";

/**
 * Generic registry item that can come from various JSON structures.
 * Different registries may use different property names for similar concepts.
 */
export interface RegistryItem {
  /** Unique identifier for the item */
  id: string;
  /** Primary name of the item */
  name?: string;
  /** Alternative name field used by some registries */
  title?: string;
  /** Primary description of the item */
  description?: string;
  /** Alternative description field used by some registries */
  summary?: string;
  /** Icon URL */
  icon?: string;
  /** Alternative icon field */
  image?: string;
  /** Alternative icon field */
  logo?: string;
  /** Whether the item is verified */
  verified?: boolean;
  /** Publisher name */
  publisher?: string;
  /** Available tools */
  tools?: Array<{
    id?: string;
    name?: string;
    description?: string | null;
  }>;
  /** Available models */
  models?: unknown[];
  /** Available emails */
  emails?: unknown[];
  /** Analytics configuration */
  analytics?: unknown;
  /** CDN configuration */
  cdn?: unknown;
  /** Metadata with various provider-specific information */
  _meta?: MCPRegistryServerMeta;
  /** Alternative metadata field */
  meta?: {
    verified?: boolean;
    [key: string]: unknown;
  };
  /** Nested server object (used by MCPRegistryServer format) */
  server?: {
    title?: string;
    description?: string;
    icons?: Array<{ src: string }>;
    tools?: unknown[];
    models?: unknown[];
    emails?: unknown[];
    analytics?: unknown;
    cdn?: unknown;
    _meta?: MCPRegistryServerMeta;
  };
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
