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

export const TOOL_READ_PROMPT = `Read a tool definition including metadata, schemas, and execute code.

Returns:
- Tool metadata (name, description)
- Input/output JSON schemas
- Execute code (inline ES module)
- Dependencies (integration IDs used in ctx.env calls)

The tool's execute code uses \`ctx.env['{INTEGRATION_ID}'].{TOOL_NAME}(args)\` to call integrations.`;

export const TOOL_CREATE_PROMPT = `Create an executable tool with JSON Schema validation.

## Tool Execute Function

Tools must export a default async function:

\`\`\`javascript
export default async function(input, ctx) {
  // input: validated against tool's inputSchema
  
  // Call integration tools (must declare in dependencies array)
  const result = await ctx.env['i:slack'].send_message({
    channel: input.channel,
    text: input.message
  });
  
  // Return: must match tool's outputSchema
  return { success: true, messageId: result.ts };
}
\`\`\`

**Key Points:**
- **inputSchema** defines the \`input\` parameter type and validation
- **outputSchema** defines the return value type and validation
- **execute** is the function code as an inline ES module string
- **dependencies** (optional): Array of \`{ integrationId }\` for ctx.env calls

**Integration IDs:**
- Don't know the ID? Use a placeholder like \`i:slack\` or \`i:database\`
- Validation will show available integrations if the ID doesn't exist
- System will guide you to the correct ID

**HTTP Requests:**
- \`fetch\` is NOT available in this environment
- To make HTTP requests, use the \`i:http\` integration with the \`HTTP_FETCH\` tool
- Example: \`await ctx.env['i:http'].HTTP_FETCH({ url: '...', method: 'GET' })\`
- Remember to add \`{ integrationId: 'i:http' }\` to dependencies
`;

export const TOOL_UPDATE_PROMPT = `Update a tool's metadata, schemas, or execution code.

## Execute Function API

\`\`\`javascript
export default async function(input, ctx) {
  // Call integration tools
  const result = await ctx.env['i:integration'].tool_name({ args });
  return { output: result };
}
\`\`\`

## Update Guidelines

1. **Maintain function signature** - Keep \`async function(input, ctx)\` format
2. **Match schemas** - Input/output must match updated schemas
3. **Use placeholder integration IDs** - Validation will show available integrations
4. **Update dependencies** - Add \`{ integrationId }\` for any ctx.env calls
5. **Test thoroughly** - Input/output are validated automatically

**Integration IDs:**
- Use placeholders like \`i:slack\` if you don't know the ID
- Validation errors will list all available integrations
- Copy the correct ID from the error message

**HTTP Requests:**
- \`fetch\` is NOT available in this environment
- To make HTTP requests, use the \`i:http\` integration with the \`HTTP_FETCH\` tool
- Example: \`await ctx.env['i:http'].HTTP_FETCH({ url: '...', method: 'GET' })\`
- Remember to add \`{ integrationId: 'i:http' }\` to dependencies`;

export const TOOL_DELETE_PROMPT = `Delete a tool from the code environment.

This operation removes both the tool definition and its associated function file
from the environment. Use this to clean up unused or obsolete tools.

Warning: This action cannot be undone. The tool and its function code will be
permanently removed from the environment.`;
