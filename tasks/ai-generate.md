# AI Generation Tool Specification

This system has a bunch of tools (RPC) to make the system work. These tools are grouped by functionality (e.g., Agents Management, Thread Management, Wallet & Billing).

I want to create a new tool inside a new group called **AI**.

## Tool Overview

**Tool Name**: `GENERATE`  
**Group**: AI Generation  
**Objective**: Allow the system to make standalone calls to LLM/AI models, similar to the type of call we do for Agents to work, but without requiring an agent context.

The input for this tool will match `agent.generate` from Mastra (which comes from @ai/sdk). The inputSchema must be well constructed and the outputSchema as well.

Just like agent.ts, this tool call must check the Wallet because AI generation consumes credits.

## Technical Implementation Details

### File Structure
Based on the existing patterns, this should be implemented as:
- **File**: `packages/sdk/src/mcp/ai/api.ts`
- **Group Registration**: Add to `packages/sdk/src/mcp/index.ts` in a new `AI_TOOLS` array

### Input Schema (simplified for standalone usage)
```typescript
const AIGenerateInputSchema = z.object({
  // Core generation parameters
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    createdAt: z.date().optional(),
    experimental_attachments: z.array(z.object({
      name: z.string().optional().describe("The name of the attachment, usually the file name"),
      contentType: z.string().optional().describe("Media type of the attachment"),
      url: z.string().describe("URL of the attachment (hosted file or Data URL)"),
    })).optional().describe("Additional attachments to be sent along with the message"),
  })).describe("Array of messages for the conversation"),
  
  // Model and configuration
  model: z.string().optional().describe("Model ID to use for generation (defaults to workspace default)"),
  instructions: z.string().optional().describe("System instructions/prompt"),
  
  // Generation limits
  maxTokens: z.number().default(8192).optional().describe("Maximum number of tokens to generate"),
  
  // Tool integration (optional)
  tools: z.record(z.string(), z.array(z.string())).optional().describe("Tools available for the generation"),
});
```

### Output Schema (based on GenerateTextResult from @ai/sdk)
```typescript
const AIGenerateOutputSchema = z.object({
  text: z.string().describe("The generated text response"),
  usage: z.object({
    promptTokens: z.number().describe("Number of tokens in the prompt"),
    completionTokens: z.number().describe("Number of tokens in the completion"),
    totalTokens: z.number().describe("Total number of tokens used"),
  }).describe("Token usage information"),
  finishReason: z.enum(["stop", "length", "content-filter", "tool-calls"]).optional().describe("Reason why generation finished"),
  // Additional metadata as needed
});
```

### Wallet Integration Requirements
The tool must implement wallet checking similar to `packages/ai/src/agent.ts`:

1. **Pre-generation**: Check wallet balance using workspace wallet client
2. **Post-generation**: Track usage as "AI Direct" category 
3. **Error handling**: Throw "Insufficient funds" if balance is inadequate
4. **Model Selection**: Use same LLM configuration logic as `agent.ts` (from `packages/ai/src/agent/llm.ts`)

### Implementation Structure
```typescript
// packages/sdk/src/mcp/ai/api.ts
import { createToolGroup } from "../context.ts";
import { createWalletClient } from "../wallet/index.ts";
import { getLLMConfig, createLLMInstance } from "@deco/ai/agent/llm.ts";

const createTool = createToolGroup("AI", {
  name: "AI Generation",  
  description: "Direct AI model generation capabilities.",
  icon: "https://assets.decodecache.com/mcp/[icon-id]/AI-Generation.png", // Need icon
});

export const aiGenerate = createTool({
  name: "GENERATE",
  description: "Generate text using AI models directly without agent context (stateless)",
  inputSchema: AIGenerateInputSchema,
  outputSchema: AIGenerateOutputSchema,
  handler: async (input, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);
    
    // Implementation steps:
    // 1. Get wallet client and check balance
    // 2. Configure LLM using same logic as agent.ts
    // 3. Perform stateless generation (no threads)
    // 4. Track usage as "AI Direct" category
    // 5. Return generation result
    
    const wallet = getWalletClient(c);
    // ... rest of implementation
  },
});
```

## Design Decisions (Clarified)

✅ **Model Selection**: Use the same model selection logic as `agent.ts` - access to all available models with workspace default as fallback

✅ **Default Configuration**:
   - `maxTokens`: 8192 (same as agents)
   - `model`: Use same default logic as clients (DEFAULT_MODEL.id)

✅ **Tool Access**: Optional tool integration - workspace tools available if specified in input

✅ **Memory/Context**: Completely stateless - no thread creation or persistence

✅ **Authentication & Access**: Same workspace access controls as other tools - check user has workspace access

✅ **Usage Tracking**: Track as "AI Direct" category, associated with the user making the call

## Remaining Implementation Questions

1. **Tool Safety**: Should there be any restrictions on which workspace tools can be called from standalone AI generation?

2. **Usage Category**: Should billing differentiate "AI Direct" usage from agent usage in reporting?

## Related Files to Modify

1. **Add AI tools to index**: `packages/sdk/src/mcp/index.ts`
2. **Create AI API module**: `packages/sdk/src/mcp/ai/api.ts` 
3. **Export from SDK**: `packages/sdk/src/index.ts` (if needed)
4. **Update tool registration**: Add `AI_TOOLS` to `WORKSPACE_TOOLS` array

## Implementation Notes

- **Stateless Design**: No thread creation or memory persistence - each call is independent
- **LLM Configuration**: Reuse existing infrastructure from `packages/ai/src/agent/llm.ts`
- **Model Defaults**: Use `DEFAULT_MODEL.id` with same fallback logic as agents
- **Wallet Integration**: Use workspace wallet client with "AI Direct" usage tracking
- **Error Handling**: Follow existing MCP error patterns
- **Attachments**: Support experimental_attachments in messages (file uploads, PDFs, etc.)
- **Tool Integration**: Optional - if tools specified, use same workspace tool access as agents
- **Message Conversion**: Reuse logic from `packages/ai/src/agent/ai-message.ts` for attachment handling