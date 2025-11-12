# Theme-Aware Views Implementation Summary

## 🎉 What Was Built

We've implemented a **BONKERS** new feature that makes Views automatically inherit and adapt to workspace themes! This means:

- ✅ Views automatically use workspace theme colors, borders, and design tokens
- ✅ When you change your workspace theme, all views update in real-time
- ✅ AI assistants are trained to create theme-consistent UIs using design tokens
- ✅ Comprehensive documentation about Basecoat UI for HTML-only components
- ✅ Zero configuration required - it just works!

## 🏗️ Implementation Details

### 1. Theme Variable Injection

**Modified:** `apps/web/src/utils/view-template.ts`

- Added `themeVariables` parameter to `generateViewHTML()` function
- Injects all workspace theme CSS custom properties into view HTML's `:root` selector
- Sets default background and foreground colors on body element

```typescript
export function generateViewHTML(
  code: string,
  apiBase: string,
  workspace: string,
  project: string,
  trustedOrigin: string,
  importmap?: Record<string, string>,
  themeVariables?: Record<string, string>, // ← NEW!
): string
```

The generated HTML now includes:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.2050 0 0);
  --primary: oklch(0.8916 0.2037 118.17);
  /* ... all workspace theme tokens ... */
}

body {
  background: var(--background, oklch(1 0 0));
  color: var(--foreground, oklch(0.2050 0 0));
}
```

### 2. Real-Time Theme Updates

**Modified:** `apps/web/src/components/views/view-detail.tsx`

- Added `useTheme()` hook to access current workspace theme
- Listens for `theme-updated` events to trigger view regeneration
- Passes theme variables to `generateViewHTML()` function

```typescript
const { data: theme } = useTheme();
const [themeUpdateTrigger, setThemeUpdateTrigger] = useState(0);

// Listen for theme updates
useEffect(() => {
  const handleThemeUpdate = () => {
    setThemeUpdateTrigger((prev) => prev + 1);
  };
  window.addEventListener("theme-updated", handleThemeUpdate);
  return () => window.removeEventListener("theme-updated", handleThemeUpdate);
}, []);

// Pass theme to HTML generator
const htmlValue = useMemo(() => {
  return generateViewHTML(
    currentCode,
    DECO_CMS_API_URL,
    org,
    project,
    window.location.origin,
    effectiveView?.importmap,
    theme?.variables as Record<string, string> | undefined, // ← Theme tokens!
  );
}, [currentCode, effectiveView?.importmap, org, project, theme?.variables, themeUpdateTrigger]);
```

### 3. AI Training for Theme-Aware Development

**Modified:** `packages/sdk/src/mcp/views/api.ts`

Added comprehensive AI prompt (200+ lines) that teaches the AI assistant to:

- **Use theme tokens instead of hardcoded colors**
  - `--background`, `--foreground`, `--card`, `--primary`, etc.
  - `--radius`, `--spacing` for consistent layout
  - `--border`, `--ring`, `--input` for consistent borders and focus states

- **Apply semantic token meanings**
  - `--destructive` for delete buttons
  - `--success` for confirmations
  - `--warning` for cautions
  - `--muted` for disabled states

- **Use Basecoat UI patterns**
  - Since views run in browser without build step, can't use React shadcn/ui
  - Basecoat UI (https://basecoatui.com/) provides HTML-only versions
  - Includes examples of buttons, cards, alerts, tables, etc.

- **Write accessible, responsive UIs**
  - Proper focus states with `--ring`
  - Responsive design with Tailwind breakpoints
  - Proper contrast using foreground token pairs

**Example from the AI prompt:**

```jsx
// ✅ Good - Uses theme tokens
<button 
  className="px-4 py-2 rounded-[var(--radius)]"
  style={{
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)'
  }}
>
  Primary Action
</button>

// ❌ Bad - Hardcoded colors
<button className="px-4 py-2 bg-blue-500 text-white rounded">
  Click me
</button>
```

### 4. Updated View Creation Prompts

**Modified:** `packages/sdk/src/mcp/views/prompts.ts`

Added comprehensive sections about:

- **Theme Tokens (CSS Custom Properties)**
  - Complete list of available tokens with descriptions
  - When to use each token semantically
  - Examples of proper usage in Tailwind

- **Basecoat UI Integration**
  - Why you can't use React shadcn/ui (no build step)
  - How to use Basecoat UI HTML-only components
  - Examples of cards, buttons, badges, alerts with theme tokens

- **Updated Best Practices**
  - Always use theme tokens (now #3 priority)
  - Semantic token usage guidance
  - Leverage Basecoat UI patterns

## 📚 Available Design Tokens

### Color Tokens (Semantic)
| Token | Usage |
|-------|-------|
| `--background` | Main page background |
| `--foreground` | Primary text color |
| `--card` / `--card-foreground` | Card/panel backgrounds and text |
| `--primary` / `--primary-foreground` | Primary brand color (CTAs, key actions) |
| `--secondary` / `--secondary-foreground` | Secondary UI elements |
| `--muted` / `--muted-foreground` | Subtle backgrounds, disabled states |
| `--accent` / `--accent-foreground` | Highlights, hover states |
| `--destructive` / `--destructive-foreground` | Delete, error states |
| `--success` / `--success-foreground` | Success, confirmation states |
| `--warning` / `--warning-foreground` | Warning, caution states |
| `--border` | Borders, dividers, outlines |
| `--input` | Input field borders |
| `--ring` | Focus ring for accessibility |

### Layout Tokens
| Token | Usage |
|-------|-------|
| `--radius` | Border radius for rounded corners |
| `--spacing` | Base spacing unit |

### Chart Tokens
| Token | Usage |
|-------|-------|
| `--chart-1` through `--chart-5` | Data visualization colors |

### Sidebar Tokens
| Token | Usage |
|-------|-------|
| `--sidebar` / `--sidebar-foreground` | Sidebar colors |
| `--sidebar-accent` / `--sidebar-accent-foreground` | Sidebar accents |
| `--sidebar-border` | Sidebar dividers |

## 🎨 Usage Examples

### Basic Themed Component

```jsx
export const App = () => {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6">
      <div 
        className="border p-6"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius)'
        }}
      >
        <h1 className="text-2xl font-bold" style={{ color: 'var(--card-foreground)' }}>
          Themed Card
        </h1>
        <p style={{ color: 'var(--muted-foreground)' }}>
          This automatically adapts to workspace theme changes
        </p>
      </div>
    </div>
  );
};
```

### Semantic Buttons

```jsx
<div className="flex gap-2">
  {/* Primary action */}
  <button 
    className="px-4 py-2 rounded-[var(--radius)]"
    style={{
      backgroundColor: 'var(--primary)',
      color: 'var(--primary-foreground)'
    }}
  >
    Save
  </button>

  {/* Destructive action */}
  <button 
    className="px-4 py-2 rounded-[var(--radius)]"
    style={{
      backgroundColor: 'var(--destructive)',
      color: 'var(--destructive-foreground)'
    }}
  >
    Delete
  </button>

  {/* Secondary action */}
  <button 
    className="px-4 py-2 border rounded-[var(--radius)]"
    style={{
      backgroundColor: 'var(--secondary)',
      color: 'var(--secondary-foreground)',
      borderColor: 'var(--border)'
    }}
  >
    Cancel
  </button>
</div>
```

### Status Badges

```jsx
<div className="flex gap-2">
  <span 
    className="px-3 py-1 rounded-[var(--radius)] text-sm"
    style={{
      backgroundColor: 'var(--success)',
      color: 'var(--success-foreground)'
    }}
  >
    Active
  </span>
  
  <span 
    className="px-3 py-1 rounded-[var(--radius)] text-sm"
    style={{
      backgroundColor: 'var(--warning)',
      color: 'var(--warning-foreground)'
    }}
  >
    Pending
  </span>
  
  <span 
    className="px-3 py-1 rounded-[var(--radius)] text-sm"
    style={{
      backgroundColor: 'var(--destructive)',
      color: 'var(--destructive-foreground)'
    }}
  >
    Error
  </span>
</div>
```

## 📖 Documentation Created

### 1. Feature Documentation
**File:** `docs/features/themed-views.md`

Comprehensive guide covering:
- Overview and key features
- All available design tokens
- Usage examples
- Basecoat UI integration
- Best practices
- Complete example implementations
- Implementation details
- Testing guide

### 2. Example View Template
**File:** `docs/examples/themed-view-example.jsx`

Complete working example demonstrating:
- Theme token usage throughout
- Reusable themed components
- Semantic token usage (primary, destructive, success, warning)
- Responsive design
- Data fetching with `callTool()`
- Loading states and error handling
- Accessible focus states

## 🚀 How It Works

### Flow Diagram

```
1. User opens/edits view
   ↓
2. ViewDetail component fetches current workspace theme
   ↓
3. Theme variables extracted from theme.variables
   ↓
4. generateViewHTML() injects theme variables into :root
   ↓
5. View iframe renders with theme tokens available
   ↓
6. User changes workspace theme in Settings → Theme Editor
   ↓
7. "theme-updated" event fires
   ↓
8. ViewDetail regenerates HTML with new theme variables
   ↓
9. View automatically updates with new colors!
```

### Event Flow for Theme Updates

```typescript
// Theme Editor (apps/web/src/components/theme-editor/theme-editor-view.tsx)
async function onSubmit(data: ThemeEditorFormValues) {
  await updateOrgThemeMutation.mutateAsync(data);
  // Dispatch custom event
  window.dispatchEvent(new CustomEvent("theme-updated"));
}

// ViewDetail component (apps/web/src/components/views/view-detail.tsx)
useEffect(() => {
  const handleThemeUpdate = () => {
    setThemeUpdateTrigger((prev) => prev + 1); // Trigger re-render
  };
  window.addEventListener("theme-updated", handleThemeUpdate);
  return () => window.removeEventListener("theme-updated", handleThemeUpdate);
}, []);

// HTML regenerates with new theme variables
const htmlValue = useMemo(() => {
  return generateViewHTML(
    currentCode,
    DECO_CMS_API_URL,
    org,
    project,
    window.location.origin,
    effectiveView?.importmap,
    theme?.variables, // ← Fresh theme values
  );
}, [currentCode, effectiveView?.importmap, org, project, theme?.variables, themeUpdateTrigger]);
```

## ✅ Testing Checklist

To test the implementation:

- [x] Create a new view using AI chat
- [x] Verify AI uses theme tokens (e.g., `var(--primary)`) instead of hardcoded colors
- [x] Navigate to Settings → Theme Editor
- [x] Change a color value (e.g., `--primary`)
- [x] Verify view updates automatically without page refresh
- [x] Switch between theme presets (if available)
- [x] Verify all views remain visually consistent
- [x] Test with existing views - they should continue working
- [x] Create a view manually with theme tokens
- [x] Verify tokens work correctly

## 🎯 What This Enables

### For Users
1. **Consistent Branding** - All views automatically match workspace theme
2. **No Configuration** - Theme tokens work out of the box
3. **Real-Time Updates** - Change theme, see views update instantly
4. **Professional Look** - Semantic tokens ensure proper color usage

### For AI Assistants
1. **Clear Guidelines** - Comprehensive prompt teaches proper token usage
2. **Semantic Understanding** - AI knows when to use `--destructive` vs `--primary`
3. **Component Patterns** - Basecoat UI examples for consistent components
4. **Best Practices** - Built-in knowledge of accessibility and responsiveness

### For Developers
1. **Faster Development** - No need to think about colors
2. **Maintainability** - Theme changes don't require code updates
3. **Consistency** - Design system enforced through tokens
4. **Flexibility** - Easy to override tokens for special cases

## 🔮 Future Enhancements

Potential improvements for the future:

- [ ] Theme token autocomplete in view code editor
- [ ] Visual theme token picker in view editor UI
- [ ] Export themed views as standalone HTML
- [ ] Support custom theme tokens per view
- [ ] Theme preview mode (test multiple themes)
- [ ] Dark/light mode toggle for view preview
- [ ] Theme token documentation sidebar in editor
- [ ] Import Basecoat UI components via CDN

## 📝 Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/utils/view-template.ts` | Added theme variable injection to HTML generation |
| `apps/web/src/components/views/view-detail.tsx` | Added theme hook and update listener |
| `packages/sdk/src/mcp/views/api.ts` | Added comprehensive AI prompt with 200+ lines of design token documentation |
| `packages/sdk/src/mcp/views/prompts.ts` | Updated creation prompts with theme token guidance |

## 📚 Files Created

| File | Purpose |
|------|---------|
| `docs/features/themed-views.md` | Complete feature documentation and guide |
| `docs/examples/themed-view-example.jsx` | Working example template with theme tokens |
| `THEMED_VIEWS_IMPLEMENTATION.md` | This summary document |

## 🎉 Result

You now have a **BONKERS** theme system where:

1. **Views automatically inherit workspace theme** - Zero config required
2. **AI assistants are theme-aware** - They'll use tokens automatically
3. **Real-time theme updates** - Change theme, views update instantly
4. **Comprehensive documentation** - Everything is documented with examples
5. **Professional component patterns** - Basecoat UI guidance included

The system works seamlessly - just create views with theme tokens, and they'll always match your workspace branding! 🚀✨

