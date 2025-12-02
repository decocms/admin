# Store Discovery Component - Usage Examples

## Simple Usage (Recommended)

Use `StoreDiscovery` quando você tem um `registryId` e quer que ele automaticamente:
- Busque a ferramenta `_LIST` do registry
- Chame a ferramenta para listar items
- Renderize a UI com search/filter

```tsx
import { StoreDiscovery } from "@/web/components/store";

export function MyStorePage() {
  const registryId = "registry-123";

  return <StoreDiscovery registryId={registryId} />;
}
```

## With Registry Selector (Full Page)

Complete store page com seleção de registry:

```tsx
import { useState } from "react";
import { StoreRegistrySelect } from "@/web/components/store-registry-select";
import { EmptyState } from "@/web/components/empty-state";
import { StoreDiscovery } from "@/web/components/store";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useNavigate } from "@tanstack/react-router";

export default function StorePage() {
  const { org } = useProjectContext();
  const navigate = useNavigate();
  const [selectedRegistry, setSelectedRegistry] = useState<string>("");
  const { data: connections = [] } = useConnections();

  const handleAddNewRegistry = () => {
    navigate({
      to: "/$org/mcps",
      params: { org },
      search: { action: "create" },
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background border-b border-border">
        <div className="px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <h1 className="text-base font-light tracking-tight">Store</h1>
            <StoreRegistrySelect
              registries={connections.map((c) => ({
                id: c.id,
                name: c.title,
                icon: c.icon || undefined,
              }))}
              value={selectedRegistry}
              onValueChange={setSelectedRegistry}
              onAddNew={handleAddNewRegistry}
              placeholder="Select store..."
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="h-full flex flex-col overflow-hidden">
        {selectedRegistry ? (
          <StoreDiscovery registryId={selectedRegistry} />
        ) : (
          <EmptyState
            image={
              <img
                src="/store-empty-state.svg"
                alt="No store connected"
                width={423}
                height={279}
                className="max-w-full h-auto"
              />
            }
            title="No store connected"
            description="Connect to a store to discover and install MCPs from the community."
            actions={
              <StoreRegistrySelect
                registries={connections.map((c) => ({
                  id: c.id,
                  name: c.title,
                  icon: c.icon || undefined,
                }))}
                value={selectedRegistry}
                onValueChange={setSelectedRegistry}
                onAddNew={handleAddNewRegistry}
                placeholder="Select store..."
              />
            }
          />
        )}
      </div>
    </div>
  );
}
```

## Advanced: Custom UI with StoreDiscoveryUI

Use `StoreDiscoveryUI` quando você quer controlar completamente os dados:

```tsx
import { useState, useMemo } from "react";
import { StoreDiscoveryUI, type RegistryItem } from "@/web/components/store";

export function CustomStoreView() {
  const [items, setItems] = useState<RegistryItem[]>([
    {
      id: "1",
      name: "Google Sheets",
      description: "Manage spreadsheets",
      icon: "https://example.com/sheets.png",
    },
    {
      id: "2",
      name: "Slack",
      description: "Send messages and notifications",
      icon: "https://example.com/slack.png",
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleItemClick = (item: RegistryItem) => {
    console.log("Clicked:", item);
    // Pode instalar, abrir modal, navegar, etc
  };

  return (
    <StoreDiscoveryUI
      items={items}
      isLoading={isLoading}
      error={error}
      onItemClick={handleItemClick}
    />
  );
}
```

## Hook-Based: Using useRegistryMCPs

Se você quer só a lógica de fetching de uma registry, use a hook diretamente:

```tsx
import { useRegistryMCPs } from "@/web/hooks/collections/use-registry-mcps";

export function MyComponent() {
  const { data: mcps } = useRegistryMCPs("registry-123");

  return (
    <div>
      <h2>MCPs in Registry</h2>
      {mcps.map((mcp) => (
        <div key={mcp.id}>
          <h3>{mcp.name}</h3>
          <p>{mcp.description}</p>
        </div>
      ))}
    </div>
  );
}
```

## Individual Components

### RegistryItemCard

```tsx
import { RegistryItemCard } from "@/web/components/store";

export function MyCard() {
  return (
    <RegistryItemCard
      id="item-1"
      name="Google Sheets"
      description="Manage spreadsheets with structured data"
      icon="https://example.com/icon.png"
      onClick={() => console.log("clicked")}
    />
  );
}
```

### RegistryItemsSection

```tsx
import {
  RegistryItemsSection,
  type RegistryItem,
} from "@/web/components/store";

export function MySection() {
  const items: RegistryItem[] = [
    {
      id: "1",
      name: "Item 1",
      description: "Description 1",
    },
    {
      id: "2",
      name: "Item 2",
      description: "Description 2",
    },
  ];

  return (
    <RegistryItemsSection
      items={items}
      title="My Items"
      subtitle="Popular choices"
      onItemClick={(item) => console.log("Clicked:", item)}
    />
  );
}
```

### RegistryItemListCard

```tsx
import { RegistryItemListCard } from "@/web/components/store";

export function MySearchResult() {
  return (
    <RegistryItemListCard
      id="item-1"
      name="Google Sheets"
      description="Manage spreadsheets"
      icon="https://example.com/icon.png"
      onClick={() => console.log("clicked")}
    />
  );
}
```

## Data Flow Diagram

### Automatic (StoreDiscovery)
```
registryId
    ↓
useConnection(registryId) 
    ↓
Find _LIST tool
    ↓
useToolCall(LIST_TOOL)
    ↓
Transform to RegistryItem[]
    ↓
StoreDiscoveryUI
    ↓
Render cards + search
```

### Manual (StoreDiscoveryUI)
```
RegistryItem[] (from your API/source)
    ↓
StoreDiscoveryUI
    ↓
Render cards + search + filter
    ↓
onItemClick callback
```

## Common Patterns

### Install MCP on Click

```tsx
const handleItemClick = async (item: RegistryItem) => {
  try {
    const response = await fetch(`/api/mcps/install`, {
      method: "POST",
      body: JSON.stringify({ mcpId: item.id }),
    });
    const result = await response.json();
    console.log("Installed:", result);
  } catch (error) {
    console.error("Install failed:", error);
  }
};

<StoreDiscoveryUI
  items={items}
  isLoading={isLoading}
  error={error}
  onItemClick={handleItemClick}
/>
```

### Navigate to Item Details

```tsx
const navigate = useNavigate();

const handleItemClick = (item: RegistryItem) => {
  navigate({
    to: "/$org/store/$itemId",
    params: { org: "my-org", itemId: item.id },
  });
};
```

### Show Item in Modal

```tsx
const [selectedItem, setSelectedItem] = useState<RegistryItem | null>(null);

const handleItemClick = (item: RegistryItem) => {
  setSelectedItem(item);
};

return (
  <>
    <StoreDiscoveryUI
      items={items}
      isLoading={isLoading}
      error={error}
      onItemClick={handleItemClick}
    />
    {selectedItem && (
      <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    )}
  </>
);
```

## Types

```typescript
interface RegistryItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface StoreDiscoveryProps {
  registryId: string;
}

interface StoreDiscoveryUIProps {
  items: RegistryItem[];
  isLoading: boolean;
  error: Error | null;
  onItemClick: (item: RegistryItem) => void;
}

interface RegistryItemCardProps {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  onClick: () => void;
}
```

## Styling Customization

### Change Grid Layout

Edite `registry-items-section.tsx`:
```tsx
// Padrão: 1 col mobile, 2 col tablet, 3 col desktop
<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">

// 2 colunas em todos os tamanhos
<div className="grid grid-cols-2 gap-4">

// 4 colunas em desktop
<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
```

### Change Card Height

Edite `registry-item-card.tsx`:
```tsx
// Padrão: h-[116px]
className="... h-[116px]"

// Altura menor
className="... h-24"

// Altura maior
className="... h-40"
```

### Change Colors

```tsx
// Avatar background
className="bg-linear-to-br from-primary/20 to-primary/10"

// Card background
className="bg-card"

// Border color
className="border-border"
```

## Best Practices

1. **Use StoreDiscovery** quando você tem um registryId e quer auto-fetch
2. **Use StoreDiscoveryUI** quando você controla os dados
3. **Mantenha registryId estável** para evitar re-fetches desnecessários
4. **Trate erros** - a UI mostra error state automaticamente
5. **Forneça descrições** - items sem description mostram "No description available"
6. **Use ícones** - fallback para initials se ícone falhar

