# Workspace Selection & Onboarding Flow

## Overview

This document describes the complete user flow for workspace selection and onboarding in deco.chat. The flow guides users from login through workspace selection to a personalized onboarding experience.

## User Flow Architecture

```mermaid
graph TD
    A[User Login] --> B[Authentication]
    B --> C[Home Component]
    C --> D[Workspace Selection]
    D --> E[Select Personal/Org Workspace]
    E --> F[Navigate to /{teamSlug}/onboarding]
    F --> G[Onboarding Experience]
    G --> H[Navigate to Agents/Connections]
```

## Flow Steps

### 1. Authentication & Entry Point

- **Route**: `/login` → `/` (after auth)
- **Component**: `Home` component in `apps/web/src/main.tsx`
- **Logic**:
  - If user has `teamSlug` in URL → redirect to `/{teamSlug}/agents`
  - If no team context → redirect to `/workspace-selection`

### 2. Workspace Selection

- **Route**: `/workspace-selection`
- **Component**: `WorkspaceSelectionLayout` in `apps/web/src/components/workspace-selection/index.tsx`
- **Features**:
  - Side-by-side layout (Personal | Organizations)
  - 2-column grid within each section
  - Independent scrolling areas
  - SDK context with dummy workspace for team fetching

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Select Workspace                        │
├─────────────────────┬───────────────────────────────────────┤
│ 👤 Personal         │ 🏢 Organizations                      │
│ ┌─────────┬─────────┐ │ ┌─────────┬─────────┐                │
│ │Personal │ Team A  │ │ │ Acme    │ Tech    │                │
│ │ Space   │         │ │ │ Corp    │ Startup │                │
│ └─────────┴─────────┘ │ │12 members│8 members│                │
│                       │ └─────────┴─────────┘                │
└─────────────────────┴───────────────────────────────────────┘
```

#### Technical Implementation

- **Container**: `h-[80vh]` fixed height card
- **Sections**: `flex flex-col h-full` with independent scroll areas
- **Scrolling**: Native CSS `overflow-y-auto max-h-96`
- **Data**: Real teams + mock organizations for demo
- **Navigation**: Click workspace → `navigate(/{teamSlug}/onboarding)`

### 3. Onboarding Experience (Workflow-Based)

- **Route**: `/{teamSlug}/onboarding`
- **Component**: `OnboardingPage` in `apps/web/src/components/onboarding/onboarding-page.tsx`
- **Context**: Full authenticated SDK context with selected workspace
- **Format**: Chat-based workflow with interactive cards

#### New Onboarding Workflow

The onboarding experience is now a guided workflow that personalizes the workspace:

**Step 1: Theme Personalization**

1. Extract company colors from user's custom domain website
2. Propose theme update with color preview
3. User accepts/declines the theme suggestion
4. Apply theme if accepted

**Step 2: Contextual Suggestions**

1. Based on company context, propose relevant actions
2. User can either:
   - Select from suggested options
   - Type custom requests in chat

#### Onboarding Structure (Chat Format)

```
┌─────────────────────────────────────────────────────────────┐
│                 Welcome to {Team Name}!                    │
│              Let's personalize your workspace              │
├─────────────────────────────────────────────────────────────┤
│ 🎨 Theme Suggestion                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ I found your website at {domain} and extracted         │ │
│ │ these colors. Would you like to apply this theme?      │ │
│ │                                                         │ │
│ │ [Color Preview Card]                                    │ │
│ │ Primary: #1a73e8  Secondary: #34a853                   │ │
│ │                                                         │ │
│ │ [Apply Theme] [Skip]                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 💬 What would you like to do first?                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Based on your company, here are some suggestions:      │ │
│ │                                                         │ │
│ │ • Create a customer support agent                      │ │
│ │ • Set up document analysis workflow                    │ │
│ │ • Connect your CRM integration                         │ │
│ │                                                         │ │
│ │ Or tell me what you'd like to build...                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│ [Type your message...]                                      │
└─────────────────────────────────────────────────────────────┘
```

## Routing Configuration

### Route Order (Critical)

```typescript
// apps/web/src/main.tsx - Route order matters!
{
  path: "/workspace-selection",     // Must come BEFORE /:teamSlug?
  Component: WorkspaceSelection,
},
{
  path: "/:teamSlug?",             // Catch-all for team routes
  Component: RouteLayout,
  children: [
    { path: "onboarding", Component: OnboardingPage },
    { path: "agents", Component: AgentList },
    // ... other team routes
  ]
}
```

## Technical Implementation

### Color Extraction from Website

For extracting company colors from the user's domain, we have several options:

#### Option 1: Server-Side Scraping (Recommended)

```typescript
// Backend API endpoint: /api/extract-colors
async function extractWebsiteColors(domain: string) {
  const response = await fetch(`https://${domain}`);
  const html = await response.text();

  // Parse CSS variables, meta theme-color, favicon
  const colors = await analyzeWebsiteColors(html);
  return colors;
}
```

#### Option 2: Third-Party Color API

```typescript
// Use services like:
// - Colormind API
// - Adobe Color API
// - Custom Puppeteer service
const colors = await fetch(`/api/colors?domain=${domain}`);
```

#### Option 3: Manual Favicon Analysis

```typescript
// Extract dominant colors from favicon
const faviconUrl = `https://${domain}/favicon.ico`;
const colors = await extractColorsFromImage(faviconUrl);
```

### Theme Update Flow

```typescript
// Hook for theme updates
const { mutateAsync: updateTeamTheme } = useUpdateTeamTheme();

async function applyExtractedTheme(colors: ExtractedColors) {
  await updateTeamTheme({
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
  });
}
```

### Onboarding State Management

```typescript
interface OnboardingState {
  step: "theme" | "suggestions" | "chat";
  extractedColors?: ExtractedColors;
  themeApplied: boolean;
  suggestions: OnboardingSuggestion[];
}
```

## Data Flow

### Workspace Selection Data

- **Real Teams**: Fetched via `useUserTeams()` hook
- **Personal Workspaces**: Teams with no slug (`team.slug === ''`)
- **Team Workspaces**: Teams with slug (`team.slug !== ''`)
- **Mock Organizations**: Static array for demo purposes

### SDK Context Management

- **Workspace Selection**: Uses dummy workspace `"users/temp"` for global operations
- **Onboarding**: Uses actual selected workspace `"shared/{teamSlug}"` or `"users/{userId}"`

## Key Components

### WorkspaceSelectionLayout

```typescript
// Provides SDK context for team fetching
<SDKProvider workspace="users/temp">
  <WorkspaceSelectionContent />
</SDKProvider>
```

### WorkspaceCard

```typescript
// Reusable card component with variants
<WorkspaceCard
  workspace={workspace}
  isPersonal={boolean}
  isOrg={boolean}
/>
```

### OnboardingPage

```typescript
// Team-aware onboarding experience
const { label } = useCurrentTeam();
// Shows personalized welcome with team context
```

## Styling & UX

### Design System Usage

- **Components**: shadcn/ui components (`Card`, `Button`, `Icon`, etc.)
- **Layout**: Tailwind CSS with responsive design
- **Spacing**: Consistent padding (`p-6`, `px-8`, `gap-4`)
- **Icons**: Material Design icons (`person`, `business`)

### Responsive Behavior

- **Mobile**: Single column layout
- **Desktop**: Side-by-side sections
- **Grid**: 2 columns within each section on `sm:` and up

### Scrolling Implementation

```css
/* Native CSS scrolling - more reliable than ScrollArea */
.scroll-container {
  flex: 1;
  overflow-y: auto;
  max-height: 24rem; /* 384px */
  padding: 0 0.5rem 1rem;
}
```

## Mock Data for Development

### Personal/Team Workspaces

```typescript
const mockPersonalWorkspaces = [
  { id: "personal-1", slug: "", label: "My Personal Space" },
  { id: "team-1", slug: "my-side-project", label: "My Side Project" },
  { id: "team-2", slug: "freelance-work", label: "Freelance Work" },
  { id: "team-3", slug: "hobby-projects", label: "Hobby Projects" },
];
```

### Organization Workspaces

```typescript
const mockOrgWorkspaces = [
  { id: "org-1", slug: "acme-corp", label: "Acme Corp", memberCount: 12 },
  { id: "org-2", slug: "tech-startup", label: "Tech Startup", memberCount: 8 },
  {
    id: "org-3",
    slug: "design-agency",
    label: "Design Agency",
    memberCount: 15,
  },
  // ... more organizations
];
```

## Future Enhancements

### Workspace Selection

- [ ] Real organization data from backend
- [ ] Workspace creation flow
- [ ] Recent workspaces section
- [ ] Search/filter functionality
- [ ] Workspace avatars/branding

### Onboarding

- [ ] Multi-step onboarding wizard
- [ ] Progress tracking
- [ ] Skip/customize options
- [ ] Integration setup flow
- [ ] Team member invitations
- [ ] Initial agent creation

### Technical Improvements

- [ ] Better loading states
- [ ] Error handling
- [ ] Offline support
- [ ] Analytics tracking
- [ ] A/B testing framework

## Troubleshooting

### Common Issues

1. **Workspace selection treated as team slug**: Ensure `/workspace-selection` route comes before `/:teamSlug?`
2. **ScrollArea not working**: Use native CSS `overflow-y-auto` instead
3. **QueryClient errors**: Ensure SDK context is provided at the right level
4. **Height constraints**: Use `h-full` cascade with `flex-1` and `max-h-*`

### Debug Commands

```bash
# Check route order in main.tsx
grep -n "path.*workspace\|path.*teamSlug" apps/web/src/main.tsx

# Verify component exports
grep -n "export.*Workspace\|export.*Onboarding" apps/web/src/components/*/index.tsx
```

## File Structure

```
apps/web/src/
├── main.tsx                                    # Route configuration
├── components/
│   ├── workspace-selection/
│   │   └── index.tsx                          # Workspace selection UI
│   └── onboarding/
│       ├── index.tsx                          # Exports
│       ├── onboarding-page.tsx               # Main onboarding page
│       └── onboarding-chat.tsx               # Chat-based onboarding UI
└── hooks/
    └── use-navigate-workspace.ts              # Workspace navigation utilities

apps/api/src/
├── tools/
│   └── extract-colors.ts                      # Tool to extract website colors
└── workflows/
    └── onboarding-theme-workflow.ts          # Workflow for theme generation

packages/sdk/src/
└── hooks/
    └── teams.ts                               # Team hooks including theme updates
```

---

_Last updated: [Current Date]_
_Next review: [Future Date]_
