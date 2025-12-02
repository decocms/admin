# Store Components

Store discovery and registry item browsing components.

## Architecture

The store components are organized following a clean separation of concerns:

### Core Components

#### `store-discovery.tsx` (Logic/Container)
- Handles data fetching and transformation
- Manages the registry connection and tool calls
- Transforms API responses into `RegistryItem` objects
- Delegates rendering to `StoreDiscoveryUI`

#### `store-discovery-ui.tsx` (Presentational)
- Pure UI component for displaying store items
- Manages search, filtering, and item selection UI state
- Handles user interactions and navigation
- No API calls or data fetching logic

### UI Components

#### `registry-item-card.tsx`
- Large card for displaying a registry item
- Shows icon, name, and description
- Used in grid layouts
- Props: `id`, `name`, `description`, `icon`, `onClick`

#### `registry-item-list-card.tsx`
- Compact card for displaying items in lists
- Used in search results dropdown
- Shows minimal information with hover effects
- Props: `id`, `name`, `description`, `icon`, `onClick`

#### `registry-items-section.tsx`
- Container component for displaying items in a grid
- Shows section title and subtitle
- Renders multiple `RegistryItemCard` components
- Props: `items`, `title`, `subtitle`, `onItemClick`

### Data Flow

```
Store Page (registryId selected)
    ↓
StoreDiscovery (Container)
    ├─ useConnection(registryId) → get tools
    ├─ useToolCall(LIST_TOOL) → fetch items
    └─ Transform results → RegistryItem[]
        ↓
    StoreDiscoveryUI (Presentational)
        ├─ Display items in grid
        ├─ Handle search/filter
        ├─ Show item details on click
        └─ Manage UI state
```

## Types

```typescript
interface RegistryItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}
```

## Usage

### Basic Usage

```tsx
import { StoreDiscovery } from '@/web/components/store';

export function StorePage() {
  return <StoreDiscovery registryId="registry-123" />;
}
```

### Custom UI with StoreDiscoveryUI

```tsx
import { StoreDiscoveryUI } from '@/web/components/store';

export function CustomStore() {
  const items = [/* ... */];
  const isLoading = false;
  const error = null;

  return (
    <StoreDiscoveryUI
      items={items}
      isLoading={isLoading}
      error={error}
      onItemClick={(item) => console.log(item)}
    />
  );
}
```

## Features

- ✅ Automatic data fetching from LIST tools
- ✅ Search and filtering in real-time
- ✅ Featured and all items sections
- ✅ Item details view
- ✅ Loading, error, and empty states
- ✅ Flexible response structure handling
- ✅ Icon support with fallback initials
- ✅ Responsive grid layout

## Files Structure

```
store/
├── index.ts                          # Public exports
├── README.md                         # This file
├── store-discovery.tsx               # Container/Logic
├── store-discovery-ui.tsx            # Presentational/UI
├── registry-item-card.tsx            # Card component
├── registry-item-list-card.tsx       # List item component
├── registry-items-section.tsx        # Grid section component
├── mcp-grid.tsx                      # Legacy (kept for compatibility)
├── mcp-card.tsx                      # Legacy
├── mcp-tool-card.tsx                 # Legacy
├── mcp-tools-grid.tsx                # Legacy
└── mcp-results-view.tsx              # Legacy
```

## Styling

All components use:
- Tailwind CSS for styling
- Deco UI components (Button, Input, Icon, Card, etc.)
- Responsive grid layouts (1 col mobile, 2 col tablet, 3 col desktop)
- Consistent color scheme with primary and muted colors

## Future Enhancements

- [ ] Pagination for large item lists
- [ ] Sorting options (name, date, popularity)
- [ ] Item categories/filters
- [ ] Item installation/action buttons
- [ ] Favorites/bookmarks
- [ ] Item preview/details modal
- [ ] Infinite scroll support

