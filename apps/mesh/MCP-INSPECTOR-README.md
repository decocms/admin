# MCP Inspector Implementation

This document describes the implementation of the MCP Inspector feature for the Mesh application.

## Overview

The MCP Inspector is a comprehensive tool for testing and debugging Model Context Protocol (MCP) connections. It allows users to:

- Connect to MCP servers via SSE (Server-Sent Events)
- View and test available tools
- Read resources and resource templates
- Execute prompts with arguments
- View debug logs and connection status
- Handle OAuth authentication flows

## Files Created

### 1. `/apps/mesh/src/web/routes/orgs/mcp-inspector.tsx`

The main inspector component that provides:

**Tool Testing:**
- List all available tools from the MCP server
- View tool schemas and descriptions
- Invoke tools with custom JSON arguments
- Display tool results with JSON formatting
- Copy results to clipboard

**Resource Management:**
- Browse available resources and resource templates
- Read resource contents
- View resource metadata (URI, MIME type, description)
- Display resource contents with syntax highlighting

**Prompt Execution:**
- List available prompts
- View prompt arguments and descriptions
- Execute prompts with parameters
- Display prompt results

**Connection Monitoring:**
- Real-time connection status badges
- Error handling with retry functionality
- Debug log viewer
- Storage management (clear cached auth data)

**Features:**
- Accordion-based tool/prompt selection
- Tabbed interface (Tools, Resources, Prompts)
- Responsive layout with scrollable content areas
- Copy to clipboard functionality
- Auto-populated default values for tool arguments

### 2. `/apps/mesh/src/web/routes/oauth-callback.tsx`

OAuth callback handler for MCP authentication:

- Handles OAuth redirect after user authorization
- Processes authorization codes and state parameters
- Displays success/error messages
- Auto-closes popup window after authentication
- Integrates with `use-mcp`'s `onMcpAuthorization` function

### 3. Updated Files

**`/apps/mesh/src/web/index.tsx`:**
- Added `mcpInspectorRoute` for `/$org/connections/$connectionId/inspector`
- Added `oauthCallbackRoute` for `/oauth/callback`
- Registered routes in the router tree

**`/apps/mesh/src/web/routes/orgs/connections.tsx`:**
- Added "Inspect" menu item to connection dropdown
- Added navigation to inspector page
- Added Search icon import

**`/apps/mesh/src/index.ts`:**
- Added `/oauth/callback` to `FRONTEND_ROUTES` array
- Ensures OAuth callback route is served properly

## Usage

### Accessing the Inspector

1. Navigate to the Connections page: `/$org/connections`
2. Click the three-dot menu on any connection
3. Select "Inspect" from the dropdown menu
4. The inspector will open at: `/$org/connections/$connectionId/inspector`

### Testing Tools

1. Navigate to the "Tools" tab
2. Click on a tool to expand its details
3. Click "Select" to choose the tool for testing
4. Edit the JSON arguments in the text area
5. Click "Invoke Tool" to execute
6. View results in the output panel
7. Use the copy button to copy results to clipboard

### Reading Resources

1. Navigate to the "Resources" tab
2. Click on any resource to read its contents
3. View the resource data in the output panel
4. Resource templates are displayed separately

### Executing Prompts

1. Navigate to the "Prompts" tab
2. Select a prompt from the list
3. Provide required arguments in JSON format
4. Click "Execute Prompt" to run
5. View the prompt messages in the output panel

### OAuth Authentication

If the MCP server requires OAuth:

1. The inspector will automatically attempt to open an OAuth popup
2. If blocked, a manual link will be provided
3. Complete authentication in the popup window
4. The window will close automatically after success
5. Return to the inspector to continue testing

### Debug Logs

- Debug logs appear at the bottom of the page
- Shows connection events, errors, and status changes
- Use "Clear Storage" button to reset cached authentication

## Technical Details

### Dependencies

- **use-mcp** (v0.0.21): React hook for MCP integration
  - Handles SSE connections
  - Manages OAuth flows
  - Provides tool/resource/prompt APIs

- **@modelcontextprotocol/sdk**: Core MCP types and utilities

### Connection Flow

1. **Discovering**: Initial server discovery and capability check
2. **Authenticating**: OAuth flow if required
3. **Connecting**: Establishing SSE connection
4. **Loading**: Fetching tools, resources, and prompts
5. **Ready**: Connection active and ready for operations
6. **Failed**: Error occurred with retry option

### State Management

- Uses React Query for connection data
- Local state for tool/resource/prompt selection
- MCP state managed by `useMcp` hook
- localStorage for OAuth tokens (auto-managed)

### Error Handling

- Connection failures show retry button
- Tool invocation errors display in alerts
- Resource read errors are caught and displayed
- OAuth errors show in callback page

### Security

- OAuth tokens stored in localStorage with prefixed keys
- Tokens are scoped per connection ID
- Clear storage option for manual cleanup
- HTTPS recommended for production

## Configuration

The MCP connection is initialized with:

```typescript
useMcp({
  url: connection.connectionUrl,
  clientName: "MCP Mesh Inspector",
  clientUri: window.location.origin,
  callbackUrl: `${window.location.origin}/oauth/callback`,
  storageKeyPrefix: `mcp_mesh_${connectionId}`,
  debug: true,
  autoReconnect: true,
  autoRetry: 5000,
})
```

## UI Components

Built with Radix UI and Tailwind CSS:
- `Card` for sectioned content
- `Tabs` for main navigation
- `Accordion` for expandable tool/prompt lists
- `Dialog` not needed (uses full page)
- `ScrollArea` for long content
- `Badge` for status indicators
- `Alert` for errors and warnings
- `Button` for actions
- `Textarea` for JSON input

## Future Enhancements

Potential improvements:
- [ ] Save/load tool argument presets
- [ ] Export test results to JSON/CSV
- [ ] Tool invocation history
- [ ] Batch tool execution
- [ ] Resource search/filtering
- [ ] WebSocket connection support
- [ ] GraphQL-style query builder for complex tools
- [ ] Performance metrics (latency, throughput)
- [ ] Connection health checks
- [ ] Automated testing/scripting interface

## Troubleshooting

**Connection fails to establish:**
- Check that the connection URL is correct
- Verify the server is running and accessible
- Check for CORS issues in browser console
- Ensure SSE endpoint is properly configured

**OAuth popup blocked:**
- Use the manual authentication link provided
- Allow popups for this site in browser settings
- Try using the authenticate button (triggers user gesture)

**Tools not loading:**
- Check debug logs for errors
- Verify server implements tools/list endpoint
- Clear storage and reconnect

**Results not displaying:**
- Check for JSON parsing errors in arguments
- Verify tool schema matches provided arguments
- Check debug logs for server errors

## Related Documentation

- [use-mcp README](https://github.com/modelcontextprotocol/use-mcp)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Connection Storage](../storage/connection.ts)
- [Connection Tools](../tools/connection/)

