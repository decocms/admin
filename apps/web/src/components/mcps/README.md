# MCP Home Components

This directory contains the new organization-level MCP landing page, which replaces the previous Projects-first home screen.

## Overview

The MCP home presents two main categories:

1. **Deco MCPs** - Internal AI apps and templates (what were previously called "Projects")
2. **Connected MCPs** - External MCP servers and managed integrations

## Components

- `mcps-home.tsx` - Main page composition
- `deco-mcps.tsx` - Create cards and table for internal MCPs
- `connected-mcps.tsx` - Filters, search, and table for external connections
- `connect-mcp-dialog.tsx` - Dialog for connecting external MCP servers
- `common.tsx` - Shared presentational components (badges, metrics)

## Data Strategy

Currently uses a hybrid approach controlled by `USE_REAL_DATA` flag in each section component:

- **`USE_REAL_DATA = true`** (default): Uses real hooks (`useProjects`, `useIntegrations`)
- **`USE_REAL_DATA = false`**: Falls back to deterministic mock data

### Metrics

All metrics (# Calls, # Errors, Avg Latency) are currently **mocked** using a deterministic hash function in `generateMockMetrics()`. This ensures consistent values across renders for demo purposes.

## Future Work

### Short-term
- [ ] Connect "Create from scratch" to actual project creation flow
- [ ] Wire up template selector
- [ ] Implement real MCP connection validation
- [ ] Add error handling for failed connections

### Medium-term
- [ ] Replace mocked metrics with real telemetry data from backend
- [ ] Add MCP health status checks (ping endpoints)
- [ ] Implement connection detail/edit views
- [ ] Add connection removal/disconnection flows

### Long-term
- [ ] OAuth flow for connecting third-party MCPs
- [ ] MCP marketplace integration
- [ ] Connection templates and presets
- [ ] Advanced filtering (by status, usage patterns, etc.)
- [ ] Connection grouping and tagging

## Accessibility

All interactive elements include:
- Proper `aria-label` attributes
- Keyboard navigation support (Enter/Space for cards)
- Focus indicators (ring-2 ring-primary)
- Screen reader friendly role attributes

## Responsive Design

- Grid layouts collapse from 3 columns to 1 on mobile
- Filters wrap on narrow screens
- Tables remain scrollable on mobile

