/**
 * Tool Resource V2 Prompts
 *
 * These prompts provide detailed descriptions for Resources 2.0 operations
 * on tools, including creation, execution, and management.
 */

export const TOOL_SEARCH_PROMPT = `Search tools in the code environment.

This operation allows you to find tools by name, description, or other metadata.
Tools are executable functions with JSON Schema validation that can be created,
modified, and executed in a secure environment.

Use this to discover available tools before creating new ones or to find existing tools
for modification or execution.`;

export const TOOL_READ_PROMPT = `Read a tool definition and its associated function code.

This operation retrieves the complete definition of a tool, including:
- Tool metadata (name, description)
- Input and output JSON schemas for validation
- The execute code (inline ES module)

The tool definition includes all necessary information to understand how to use
the tool and what data it expects and returns.

If the tool calls other tools, use INTEGRATIONS_LIST to discover available
integrations and their tools to understand the context.env['{INTEGRATION_ID}'].{TOOL_NAME}
calls in the execute code. Note that integration IDs often contain special characters
and require bracket notation.`;

export const TOOL_CREATE_PROMPT = `Create a new tool with JSON Schema validation.

Create executable tools that can be run in a secure environment with
automatic input/output validation using JSON schemas.

## How to Use Tools in Your Code

**Discovering Available Tools:**
Before creating tools that interact with other services, use INTEGRATIONS_LIST to discover all available integrations and their tools:
- Call INTEGRATIONS_LIST to get a list of all integrations in the workspace
- Each integration contains its available tools with their schemas
- Use this information to understand what tools you can call

**Calling Tools from Your Tool:**
Tools can call other tools using the ctx.env object:
- Format: ctx.env['{INTEGRATION_ID}'].{TOOL_NAME}(args) (use bracket notation for integration IDs)
- The integration ID comes from the integration's connection field
- Integration IDs often contain special characters (e.g., 'i:123dsa123sf124fsd'), so always use bracket notation
- Tool names are exactly as listed in the integration's tools array
- Arguments must match the tool's input schema

**Example Tool Usage:**

Before writing your tool code, use INTEGRATIONS_LIST to discover available integrations and their tools. Then write clean code that calls the tools directly:

\`\`\`javascript
export default async function (input, ctx) {
  // Call the tool directly using the discovered integration ID and tool name
  // Note: Use bracket notation for integration IDs with special characters
  const result = await ctx.env['i:slack_workspace_123'].send_message({
    channel: input.channel,
    text: input.message
  });
  
  return { success: true, messageId: result.ts };
}
\`\`\`

## Tool Creation Example

Example tool creation:
{
  "name": "SendSlackNotification",
  "description": "Send a notification message to a Slack channel",
  "inputSchema": {
    "type": "object",
    "properties": {
      "channel": { "type": "string", "description": "Slack channel name" },
      "message": { "type": "string", "description": "Message to send" }
    },
    "required": ["channel", "message"]
  },
  "outputSchema": {
    "type": "object", 
    "properties": {
      "success": { "type": "boolean" },
      "messageId": { "type": "string" }
    },
    "required": ["success", "messageId"]
  },
  "execute": "export default async function (input, ctx) { const result = await ctx.env['i:slack_workspace_123'].send_message({ channel: input.channel, text: input.message }); return { success: true, messageId: result.ts }; }"
}

## Technical Requirements

The execute field must be inline ES module code (saved to /src/functions/{name}.ts)

The execute function signature must be:
async (input: typeof inputSchema, ctx: { env: Record<string, any> }): Promise<typeof outputSchema>

**Important:** Always use INTEGRATIONS_LIST to discover available tools before writing your tool code. This ensures you use the correct integration IDs and tool names, and understand the expected input/output schemas. Do not include the INTEGRATIONS_LIST call in your final tool code.

`;

export const TOOL_UPDATE_PROMPT = `Update an existing tool definition.

Modify the metadata, schemas, or execution code of an existing tool.
This allows you to refine tool behavior, update validation schemas, or fix bugs
in the execution logic.

When updating the execute code, ensure it maintains the same function signature
and that any changes are compatible with the existing input/output schemas.

## Tool Usage Reminders

When updating tools that call other tools:
- Use INTEGRATIONS_LIST to discover available integrations and their tools before writing code
- Call tools using ctx.env['{INTEGRATION_ID}'].{TOOL_NAME}(args) (use bracket notation for integration IDs)
- Integration IDs often contain special characters, so always use bracket notation
- Ensure arguments match the target tool's input schema
- Handle errors appropriately when calling external tools
- Do not include INTEGRATIONS_LIST calls in the final tool code`;

export const TOOL_DELETE_PROMPT = `Delete a tool from the code environment.

This operation removes both the tool definition and its associated function file
from the environment. Use this to clean up unused or obsolete tools.

Warning: This action cannot be undone. The tool and its function code will be
permanently removed from the environment.`;
