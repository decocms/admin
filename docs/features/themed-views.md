# Theme-Aware Views

## Overview

Views now automatically inherit and adapt to the workspace theme, ensuring visual consistency across all custom views. When you change your workspace theme, all views update in real-time without requiring code changes.

## Key Features

### 1. **Automatic Theme Injection**
- All theme CSS custom properties are injected into view HTML
- Views inherit colors, layout tokens, and design system values
- No manual configuration required

### 2. **Design Token System**
Views have access to a comprehensive set of design tokens:

#### Color Tokens
- `--background`, `--foreground` - Main page colors
- `--card`, `--card-foreground` - Card/panel colors
- `--primary`, `--primary-foreground` - Primary brand colors
- `--secondary`, `--secondary-foreground` - Secondary UI colors
- `--muted`, `--muted-foreground` - Subtle backgrounds and disabled states
- `--accent`, `--accent-foreground` - Highlights and hover states
- `--destructive`, `--destructive-foreground` - Error/delete states
- `--success`, `--success-foreground` - Success/confirmation states
- `--warning`, `--warning-foreground` - Warning/caution states
- `--border`, `--input`, `--ring` - Borders, inputs, focus rings

#### Layout Tokens
- `--radius` - Border radius for consistent rounded corners
- `--spacing` - Base spacing unit for padding/margins

#### Chart Colors
- `--chart-1` through `--chart-5` - Data visualization colors

#### Sidebar Tokens
- `--sidebar`, `--sidebar-foreground` - Sidebar colors
- `--sidebar-accent`, `--sidebar-accent-foreground` - Sidebar accents
- `--sidebar-border` - Sidebar dividers

### 3. **AI-Assisted Development**
When creating or editing views through AI chat, the AI is trained to:
- Use theme tokens instead of hardcoded colors
- Apply semantic token meanings (e.g., `--destructive` for delete buttons)
- Create accessible UIs with proper contrast
- Use Basecoat UI for consistent component patterns

### 4. **Real-Time Theme Updates**
- Views automatically regenerate when workspace theme changes
- No page refresh required
- Seamless visual transitions

## Usage

### Using Theme Tokens in Tailwind CSS

Views use Tailwind CSS 4. Reference tokens using the `var()` syntax:

```jsx
export const App = () => {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)] p-6">
      <button className="bg-[var(--primary)] text-[var(--primary-foreground)] rounded-[var(--radius)] px-4 py-2">
        Primary Action
      </button>
    </div>
  );
};
```

### Using Theme Tokens with Inline Styles

For dynamic styling, use inline styles with CSS custom properties:

```jsx
export const App = () => {
  return (
    <button
      style={{
        backgroundColor: 'var(--primary)',
        color: 'var(--primary-foreground)',
        borderRadius: 'var(--radius)',
        padding: '0.5rem 1rem'
      }}
    >
      Themed Button
    </button>
  );
};
```

### Basecoat UI Integration

Since views run in the browser without a build step, you cannot use React-based shadcn components. Instead, use **Basecoat UI** (https://basecoatui.com/) for HTML-only component patterns.

#### Example: Card Component

```jsx
export const App = () => {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-6">
      <h2 className="text-[var(--card-foreground)] text-xl font-bold mb-2">
        Card Title
      </h2>
      <p className="text-[var(--muted-foreground)]">
        This card automatically adapts to the workspace theme.
      </p>
    </div>
  );
};
```

#### Example: Status Badges

```jsx
export const App = () => {
  return (
    <div className="flex gap-2">
      <span 
        className="px-3 py-1 rounded-[var(--radius)] text-sm font-medium"
        style={{
          backgroundColor: 'var(--success)',
          color: 'var(--success-foreground)'
        }}
      >
        Active
      </span>
      <span 
        className="px-3 py-1 rounded-[var(--radius)] text-sm font-medium"
        style={{
          backgroundColor: 'var(--warning)',
          color: 'var(--warning-foreground)'
        }}
      >
        Pending
      </span>
      <span 
        className="px-3 py-1 rounded-[var(--radius)] text-sm font-medium"
        style={{
          backgroundColor: 'var(--destructive)',
          color: 'var(--destructive-foreground)'
        }}
      >
        Error
      </span>
    </div>
  );
};
```

## Best Practices

### 1. Always Use Theme Tokens
❌ **Bad:** Hardcoded colors
```jsx
<div className="bg-white text-black border-gray-300">
  <button className="bg-blue-500 text-white">Click me</button>
</div>
```

✅ **Good:** Theme tokens
```jsx
<div className="bg-[var(--card)] text-[var(--card-foreground)] border-[var(--border)]">
  <button className="bg-[var(--primary)] text-[var(--primary-foreground)]">Click me</button>
</div>
```

### 2. Use Semantic Tokens
Choose tokens based on their semantic meaning:
- Use `--primary` for main call-to-action buttons
- Use `--destructive` for delete/remove actions
- Use `--success` for confirmations and completed states
- Use `--warning` for caution messages
- Use `--muted` for disabled or less important content

### 3. Maintain Consistency
- Use `--radius` for all rounded corners
- Use `--border` for all dividers and outlines
- Use `--ring` for focus states (accessibility)
- Use `--spacing` as a base unit for padding/margins

### 4. Ensure Accessibility
- Always pair background tokens with their foreground counterparts
- Use `--ring` for keyboard focus indicators
- Test with different themes to ensure contrast ratios

### 5. Responsive Design
Views should work across different screen sizes:

```jsx
export const App = () => {
  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Responsive grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Cards... */}
        </div>
      </div>
    </div>
  );
};
```

## Complete Example

Here's a complete themed view example:

```jsx
export const App = () => {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-6">
          <h1 className="text-3xl font-bold text-[var(--card-foreground)] mb-2">
            Dashboard
          </h1>
          <p className="text-[var(--muted-foreground)]">
            Welcome to your themed dashboard
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-4">
            <div className="text-2xl font-bold text-[var(--card-foreground)]">1,234</div>
            <div className="text-sm text-[var(--muted-foreground)]">Total Users</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-4">
            <div className="text-2xl font-bold text-[var(--card-foreground)]">56</div>
            <div className="text-sm text-[var(--muted-foreground)]">Active Sessions</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-4">
            <div className="text-2xl font-bold text-[var(--card-foreground)]">98%</div>
            <div className="text-sm text-[var(--muted-foreground)]">Success Rate</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button 
            className="px-4 py-2 rounded-[var(--radius)] font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)'
            }}
          >
            Create New
          </button>
          <button 
            className="px-4 py-2 rounded-[var(--radius)] font-medium border transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--secondary)',
              color: 'var(--secondary-foreground)',
              borderColor: 'var(--border)'
            }}
          >
            Export Data
          </button>
          <button 
            className="px-4 py-2 rounded-[var(--radius)] font-medium border transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--destructive)',
              color: 'var(--destructive-foreground)',
              borderColor: 'var(--border)'
            }}
          >
            Delete Selected
          </button>
        </div>

        {/* Alert Messages */}
        <div 
          className="p-4 rounded-[var(--radius)] border flex items-start gap-3"
          style={{
            backgroundColor: 'var(--success)',
            color: 'var(--success-foreground)',
            borderColor: 'var(--border)'
          }}
        >
          <span className="text-xl">✓</span>
          <div>
            <strong>Success!</strong> Your changes have been saved successfully.
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted-foreground)]">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted-foreground)]">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted-foreground)]">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-[var(--card-foreground)]">John Doe</td>
                <td className="px-4 py-3">
                  <span 
                    className="px-2 py-1 rounded-[var(--radius)] text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--success)',
                      color: 'var(--success-foreground)'
                    }}
                  >
                    Active
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">2 hours ago</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
```

## Implementation Details

### Architecture

1. **Theme Injection**: Theme variables are fetched from workspace settings and injected into the view HTML template's `:root` selector
2. **Real-Time Updates**: Views listen for `theme-updated` events and automatically regenerate HTML
3. **AI Training**: The view detail renderer includes comprehensive prompts teaching AI about design tokens and Basecoat UI
4. **Backwards Compatibility**: Existing views continue to work; new views benefit from theme tokens automatically

### Files Modified

- `apps/web/src/utils/view-template.ts` - Added theme variable injection to HTML generation
- `apps/web/src/components/views/view-detail.tsx` - Added theme hook and update listener
- `packages/sdk/src/mcp/views/api.ts` - Added comprehensive AI prompt with design token documentation

### Theme Variable Flow

```
Workspace Settings (Database)
  ↓
useTheme() Hook (Frontend)
  ↓
ViewDetail Component
  ↓
generateViewHTML() Function
  ↓
:root CSS Variables in View Iframe
  ↓
View React Components (via var(--token))
```

## Testing

To test theme-aware views:

1. Create or open a view
2. Use theme tokens in your view code (e.g., `bg-[var(--primary)]`)
3. Navigate to Settings → Theme Editor
4. Change color values and observe views update in real-time
5. Switch between different theme presets to verify consistency

## Future Enhancements

- [ ] Add theme token autocomplete in view code editor
- [ ] Provide visual theme token picker in view editor
- [ ] Export themed views as standalone HTML with embedded theme
- [ ] Support custom theme tokens per view
- [ ] Add theme preview mode for testing multiple themes

## Resources

- [Basecoat UI Documentation](https://basecoatui.com/)
- [Tailwind CSS 4 Documentation](https://tailwindcss.com/)
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)

