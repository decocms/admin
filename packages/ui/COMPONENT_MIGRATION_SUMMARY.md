# UI Component Migration Summary

This document describes the generic, compositional UI components that were created to enable code sharing between `apps/web` and `apps/mesh`.

## Core Principles

1. **Single Responsibility**: Each component does ONE thing well
2. **Composition Over Configuration**: Build UIs by composing small pieces
3. **Slot-Based Architecture**: Components accept children/slots for flexibility
4. **Feature Injection**: Apps decide what features to include
5. **Brandless by Default**: No hardcoded branding in `@deco/ui`
6. **Skeleton Pattern**: Every component exports a `Component.Skeleton` for loading states

## New Generic Components

### Layout Components

#### AppTopbar
**Location**: `packages/ui/src/components/app-topbar.tsx`

A fixed topbar shell with left and right slots for composing navigation and actions.

**Usage**:
```tsx
import { AppTopbar } from "@deco/ui/components/app-topbar.tsx";

<AppTopbar>
  <AppTopbar.Left>
    <SidebarToggleButton />
    <Breadcrumb />
  </AppTopbar.Left>
  <AppTopbar.Right>
    <UserMenu />
  </AppTopbar.Right>
</AppTopbar>
```

**Skeleton**: `<AppTopbar.Skeleton />`

#### EntityGrid
**Location**: `packages/ui/src/components/entity-grid.tsx`

Responsive grid layout for displaying collections of cards or items.

**Props**:
- `columns`: Column configuration for different breakpoints `{ sm, md, lg, xl, 2xl }`
- `gap`: Spacing between items
- `className`: Additional CSS classes

**Usage**:
```tsx
import { EntityGrid } from "@deco/ui/components/entity-grid.tsx";

<EntityGrid columns={{ sm: 2, md: 3, lg: 4 }}>
  {items.map(item => <ItemCard key={item.id} {...item} />)}
</EntityGrid>
```

**Skeleton**: `<EntityGrid.Skeleton count={8} columns={{ sm: 2, md: 3, lg: 4 }} />`

#### EntityCard
**Location**: `packages/ui/src/components/entity-card.tsx`

Compound component for displaying entities (organizations, projects, etc.) with avatar, header, title, subtitle, and footer.

**Sub-components**:
- `EntityCard.Header`: Main content container with padding
- `EntityCard.AvatarSection`: Flex container for avatar and badges (flex row with space-between)
- `EntityCard.Avatar`: Display avatar with enhanced features
- `EntityCard.Content`: Container for title/subtitle
- `EntityCard.Title`: Primary title text
- `EntityCard.Subtitle`: Secondary subtitle text
- `EntityCard.Footer`: Bottom section for additional info
- `EntityCard.Badge`: Badge or label display

**Usage**:
```tsx
import { EntityCard } from "@deco/ui/components/entity-card.tsx";

<EntityCard onNavigate={() => navigate('/path')}>
  <EntityCard.Header>
    <EntityCard.AvatarSection>
      <EntityCard.Avatar url={avatarUrl} fallback={name} size="lg" />
      {/* Optional badge or icon */}
    </EntityCard.AvatarSection>
    <EntityCard.Content>
      <EntityCard.Subtitle>@slug</EntityCard.Subtitle>
      <EntityCard.Title>{name}</EntityCard.Title>
    </EntityCard.Content>
  </EntityCard.Header>
  <EntityCard.Footer>
    <MemberCount count={members.length} />
  </EntityCard.Footer>
</EntityCard>
```

**Skeleton**: `<EntityCard.Skeleton />`

### Interactive Components

#### SidebarToggleButton
**Location**: `packages/ui/src/components/sidebar-toggle-button.tsx`

Standalone button for toggling the sidebar. Uses the `useSidebar` hook from shadcn.

**Usage**:
```tsx
import { SidebarToggleButton } from "@deco/ui/components/sidebar-toggle-button.tsx";

<SidebarToggleButton />
```

**Skeleton**: `<SidebarToggleButton.Skeleton />`

#### UserMenu
**Location**: `packages/ui/src/components/user-menu.tsx`

Generic dropdown menu for user actions. Accepts custom menu items as children.

**Props**:
- `user`: User data `{ avatar?, name?, email? }`
- `trigger`: Function that returns the trigger element
- `align`: Menu alignment `"start" | "end"`
- `children`: Menu items

**Sub-components**:
- `UserMenu.Item`: Individual menu item
- `UserMenu.Separator`: Visual separator between groups

**Usage**:
```tsx
import { UserMenu } from "@deco/ui/components/user-menu.tsx";

<UserMenu 
  user={{ avatar: avatarUrl, name: userName }} 
  trigger={(user) => <Avatar {...user} />}
  align="end"
>
  <UserMenu.Item onClick={handleProfile}>
    <Icon name="account_circle" />
    Profile
  </UserMenu.Item>
  <UserMenu.Separator />
  <UserMenu.Item onClick={handleLogout}>
    <Icon name="logout" />
    Logout
  </UserMenu.Item>
</UserMenu>
```

**Skeleton**: `<UserMenu.Skeleton />`

#### SidebarFooterShell
**Location**: `packages/ui/src/components/sidebar-footer-shell.tsx`

Container for sidebar footer content. Apps inject whatever they need.

**Usage**:
```tsx
import { SidebarFooterShell } from "@deco/ui/components/sidebar-footer-shell.tsx";

<SidebarFooterShell>
  <TeamBadge />
  <UserMenu />
</SidebarFooterShell>
```

**Skeleton**: `<SidebarFooterShell.Skeleton />`

### Enhanced Components

#### Avatar
**Location**: `packages/ui/src/components/avatar.tsx`

Enhanced avatar component with:
- Deterministic color generation from strings
- Multiple shapes (circle, square)
- Multiple sizes (3xs to 3xl)
- Icon support via `icon://icon-name` URLs
- Object-fit options (contain, cover)
- Muted color variant

**Props**:
- `url`: Image URL or `icon://icon-name`
- `fallback`: Fallback text or element
- `shape`: `"circle" | "square"` (default: "square")
- `size`: `"3xs" | "2xs" | "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl"`
- `objectFit`: `"contain" | "cover"`
- `muted`: Use muted colors

**Usage**:
```tsx
import { Avatar } from "@deco/ui/components/avatar.tsx";

<Avatar 
  url={avatarUrl} 
  fallback="John Doe" 
  shape="circle" 
  size="lg"
  objectFit="cover"
/>

// Or with icon
<Avatar 
  url="icon://person" 
  fallback="User" 
  shape="square" 
  size="sm"
/>
```

**Skeleton**: `<Avatar.Skeleton shape="circle" size="lg" />`

## Migration Examples

### Before (Monolithic)

```tsx
// Old approach - tightly coupled
<OrganizationCard
  name={org.name}
  slug={org.slug}
  avatarUrl={org.avatar}
  // ... many props
/>
```

### After (Compositional)

```tsx
// New approach - composable pieces
<EntityCard onNavigate={() => navigate(`/${org.slug}`)}>
  <EntityCard.Header>
    <EntityCard.AvatarSection>
      <EntityCard.Avatar url={org.avatar} fallback={org.name} />
    </EntityCard.AvatarSection>
    <EntityCard.Content>
      <EntityCard.Subtitle>@{org.slug}</EntityCard.Subtitle>
      <EntityCard.Title>{org.name}</EntityCard.Title>
    </EntityCard.Content>
  </EntityCard.Header>
  <EntityCard.Footer>
    {/* Inject app-specific content */}
    <MemberCount teamId={org.id} />
  </EntityCard.Footer>
</EntityCard>
```

## Usage in Apps

### apps/web
- Uses all generic components
- Adds web-specific features: ExportButton, InboxPopover, ReportIssueButton
- Injects Deco branding and links
- Uses @deco/sdk for data fetching

### apps/mesh  
- Uses same generic components
- Simpler feature set (no export, no inbox)
- Brandless by default (customizable)
- Uses Better Auth for authentication

## Benefits

1. **No Code Duplication**: Shared UI logic in one place
2. **Flexibility**: Apps compose only what they need
3. **Maintainability**: Bug fixes benefit both apps
4. **Consistency**: Same visual language across apps
5. **Type Safety**: Full TypeScript support
6. **Performance**: Tree-shaking removes unused code
7. **Testability**: Small, focused components are easy to test

## Future Enhancements

- [ ] Add Storybook examples for all components
- [ ] Create brand configuration system (optional)
- [ ] Add more generic patterns as needed
- [ ] Document routing adapter patterns
- [ ] Add unit tests for generic components

