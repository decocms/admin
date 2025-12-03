# Store Components Usage Guide

This guide shows how to use the store components in your application.

## Basic Store Page (Full Implementation)

The complete store page implementation with registry selection:

```tsx
// src/web/routes/orgs/store.tsx
import { StoreRegistrySelect } from "@/web/components/store-registry-select";
import { EmptyState } from "@/web/components/empty-state";
import { StoreDiscovery } from "@/web/components/store";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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
      {/* Header with registry selector */}
      <div className="shrink-0 bg-background border-b border-border">
        <div className="px-4 py-3">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
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
      </div>

      {/* Content: either empty state or discovery */}
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

## Individual Component Usage

### StoreDiscovery (Auto-fetching with LIST tools)

```tsx
import { StoreDiscovery } from "@/web/components/store";

function MyComponent() {
  return <StoreDiscovery registryId="registry-123" />;
}
```

The component automatically:
- Finds the _LIST tool in the registry
- Calls the tool to fetch items
- Displays items with search/filter
- Shows loading, error, and empty states

### StoreDiscoveryUI (Custom UI Control)

```tsx
import { StoreDiscoveryUI, type RegistryItem } from "@/web/components/store";

function CustomStore() {
  const items: RegistryItem[] = [
    {
      id: "1",
      name: "Google Sheets",
      description: "Manage spreadsheets",
      icon: "https://example.com/icon.png",
    },
  ];

  const handleItemClick = (item: RegistryItem) => {
    console.log("Clicked:", item);
  };

  return (
    <StoreDiscoveryUI
      items={items}
      isLoading={false}
      error={null}
      onItemClick={handleItemClick}
    />
  );
}
```

### RegistryItemCard (Single Card)

```tsx
import { RegistryItemCard } from "@/web/components/store";

function ItemDisplay() {
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

### RegistryItemsSection (Grouped Items)

```tsx
import { RegistryItemsSection, type RegistryItem } from "@/web/components/store";

function FeaturedSection() {
  const items: RegistryItem[] = [
    { id: "1", name: "Item 1", description: "Description 1" },
    { id: "2", name: "Item 2", description: "Description 2" },
  ];

  return (
    <RegistryItemsSection
      items={items}
      title="Featured Items"
      subtitle="Popular choices"
      onItemClick={(item) => console.log(item)}
    />
  );
}
```

## Data Flow

### Automatic (StoreDiscovery)

```
registryId
    ↓
useConnection(registryId) → get tools
    ↓
Find tool ending with "_LIST"
    ↓
useToolCall(LIST_TOOL) → fetch items
    ↓
Transform to RegistryItem[]
    ↓
StoreDiscoveryUI (rendering)
```

### Manual (StoreDiscoveryUI)

```
RegistryItem[]
    ↓
StoreDiscoveryUI (rendering)
    ↓
Search/filter state
    ↓
Display items with interaction
```

## API Response Handling

The `StoreDiscovery` component automatically handles multiple response formats:

### Format 1: Direct Array
```json
[
  { "id": "1", "name": "Item 1", "description": "..." }
]
```

### Format 2: Nested in Object
```json
{
  "items": [
    { "id": "1", "name": "Item 1", "description": "..." }
  ]
}
```

### Format 3: Alternative Keys
```json
[
  { "id": "1", "title": "Item 1", "summary": "..." }
]
```

The component will automatically map:
- `title` → `name`
- `summary` → `description`
- Generate IDs and fallback names if missing

## Styling Customization

All components use Tailwind CSS and can be customized:

```tsx
// Custom card size
<RegistryItemCard
  // ... props
  className="h-48" // Override height
/>

// Custom section layout
<RegistryItemsSection
  // ... props
  // Modify grid in registry-items-section.tsx
  // Change: grid-cols-1 lg:grid-cols-2 xl:grid-cols-3
/>
```

## Type Definitions

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
```

## Best Practices

1. **Use StoreDiscovery for simplicity**: It handles all data fetching automatically
2. **Use StoreDiscoveryUI for control**: When you need custom data handling
3. **Keep registryId stable**: Avoid unnecessary re-renders
4. **Handle errors gracefully**: The UI shows error states automatically
5. **Provide meaningful descriptions**: Items should have clear descriptions for UX
6. **Use icons**: Icon URLs improve visual appeal (falls back to initials)

## Common Patterns

### Filter Items Locally

```tsx
const [search, setSearch] = useState("");
const filtered = items.filter(item =>
  item.name.toLowerCase().includes(search.toLowerCase())
);

<StoreDiscoveryUI
  items={filtered}
  // ...
/>
```

### Add Action on Click

```tsx
const handleItemClick = (item: RegistryItem) => {
  // Install, navigate, open modal, etc.
  installMCP(item.id);
};

<StoreDiscoveryUI
  onItemClick={handleItemClick}
  // ...
/>
```

### Show Loading State

```tsx
<StoreDiscoveryUI
  items={items}
  isLoading={isLoadingItems}
  error={error}
  onItemClick={handleClick}
/>
```

## Troubleshooting

### Items Not Showing

1. Check `registryId` is valid
2. Verify registry has tools ending with `_LIST`
3. Check API response format matches expected structure
4. Look at browser console for errors

### Search Not Working

1. Ensure items have `name` field
2. Check description field spelling
3. Verify search is typed correctly (case-insensitive)

### Icons Not Showing

1. Verify icon URL is accessible
2. Ensure CORS headers are correct
3. Icons fall back to initials if URL fails

