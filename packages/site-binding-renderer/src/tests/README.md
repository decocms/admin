# Integration Tests

This directory contains integration tests that verify the `site-binding-renderer` works correctly with a real MCP server.

## Prerequisites

1. **Running MCP Server**: You need a local MCP server that implements the `SITE` binding running at `http://localhost:3001/deco-team/site-binding/self/mcp` (or set `MCP_SERVER_URL` to your server's URL).

2. **Authentication**: The server requires authentication via cookies. To get your session cookie:
   - Open your browser and navigate to `http://localhost:3000` (or your admin URL)
   - Log in to your account
   - Open Developer Tools (F12)
   - Go to the "Application" or "Storage" tab
   - Find "Cookies" and locate cookies for `localhost`
   - Copy the entire cookie string (e.g., `sb-access-token=xxx; sb-refresh-token=yyy`)

## Running the Tests

Set the environment variables and run the tests:

```bash
# Set the MCP server URL (optional, defaults to localhost:3001)
export MCP_SERVER_URL="http://localhost:3001/deco-team/site-binding/self/mcp"

# Set your session cookie (required for authentication)
export MCP_SERVER_TOKEN="sb-access-token=your-token-here; sb-refresh-token=your-refresh-token-here"

# Run the tests
bun test src/tests/integration.test.ts
```

## What the Tests Verify

1. **Connection**: Verifies the client can connect to the MCP server
2. **Tool Listing**: Checks that required SITE binding tools are present
3. **Page Rendering**: Tests `GET_PAGE_CONTENT_FOR_PATH` returns valid page structure
4. **Content Types**: Verifies `LIST_CONTENT_TYPES` returns content type definitions

## Troubleshooting

- **401 Unauthorized**: Your session cookie has expired. Get a fresh cookie from the browser.
- **404 Not Found**: The server URL is incorrect or the server is not running.
- **500 Internal Server Error**: Check the server logs for details.
