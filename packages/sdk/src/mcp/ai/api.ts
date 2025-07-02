import { Agent } from "@mastra/core/agent";
import { getLLMConfig, createLLMInstance } from "@deco/ai/agent/llm";
import { z } from "zod";
import { DEFAULT_MODEL } from "../../constants.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import { createWalletClient, MicroDollar, WellKnownWallets } from "../wallet/index.ts";
import { InternalServerError } from "../index.ts";

const getWalletClient = (c: AppContext) => {
  if (!c.envVars.WALLET_API_KEY) {
    throw new InternalServerError("WALLET_API_KEY is not set");
  }
  return createWalletClient(c.envVars.WALLET_API_KEY, c.walletBinding);
};

const createTool = createToolGroup("AI", {
  name: "AI Generation",
  description: "Direct AI model generation capabilities.",
  icon: "https://assets.decocache.com/mcp/ai-generation.png",
});

// Input Schema (simplified for standalone usage)
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

// Output Schema (based on GenerateTextResult from @ai/sdk)
const AIGenerateOutputSchema = z.object({
  text: z.string().describe("The generated text response"),
  usage: z.object({
    promptTokens: z.number().describe("Number of tokens in the prompt"),
    completionTokens: z.number().describe("Number of tokens in the completion"),
    totalTokens: z.number().describe("Total number of tokens used"),
  }).describe("Token usage information"),
  finishReason: z.enum(["stop", "length", "content-filter", "tool-calls"]).optional().describe("Reason why generation finished"),
});

export const aiGenerate = createTool({
  name: "GENERATE",
  description: "Generate text using AI models directly without agent context (stateless)",
  inputSchema: AIGenerateInputSchema,
  outputSchema: AIGenerateOutputSchema,
  handler: async (input, c) => {
    assertHasWorkspace(c);
    // await assertWorkspaceResourceAccess(c.tool.name, c);
    c.resourceAccess.grant();
    
    // 1. Check wallet balance
    const wallet = getWalletClient(c);
    const workspaceWalletId = WellKnownWallets.build(
      ...WellKnownWallets.workspace.genCredits(c.workspace.value),
    );
    
    const balanceResponse = await wallet["GET /accounts/:id"]({
      id: encodeURIComponent(workspaceWalletId),
    });

    if (balanceResponse.status === 404) {
      throw new InternalServerError("Insufficient funds");
    }

    if (!balanceResponse.ok) {
      throw new InternalServerError("Failed to check wallet balance");
    }

    const balanceData = await balanceResponse.json();
    const balance = MicroDollar.fromMicrodollarString(balanceData.balance);

    if (balance.isNegative() || balance.isZero()) {
      throw new InternalServerError("Insufficient funds");
    }

    // 2. Use LLM utilities from static import
    
    // 3. Configure model (use default if not specified)
    const modelId = input.model ?? DEFAULT_MODEL.id;
    
    // 4. Get LLM configuration for the specified model
    const llmConfig = await getLLMConfig({
      modelId,
      // Note: llmVault would be available from context if needed for custom models
    });

    // 5. Create LLM instance using the proper infrastructure
    const { llm } = createLLMInstance({
      ...llmConfig,
      envs: c.envVars as Record<string, string>,
    });

    // 6. Create temporary agent for generation (stateless)
    const tempAgent = new Agent({
      name: "AI Direct Generator",
      instructions: input.instructions || "You are a helpful AI assistant.",
      model: llm,
      mastra: {
        // @ts-ignore: Mastra requires a logger, but we don't use it
        getLogger: () => undefined,
        getTelemetry: () => undefined,
      },
    });

    // 7. Convert messages for AI SDK compatibility
    const aiMessages = input.messages.map((msg) => ({
      id: msg.id || crypto.randomUUID(),
      role: msg.role,
      content: msg.content,
      experimental_attachments: msg.experimental_attachments,
    }));

    // 8. Perform generation
    const result = await tempAgent.generate(aiMessages, {
      maxTokens: input.maxTokens,
    });

    // 9. Return result with proper type mapping
    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      finishReason: mapFinishReason(result.finishReason),
    };
  },
});

// Helper function to map finish reason to expected enum
function mapFinishReason(reason: string): "stop" | "length" | "content-filter" | "tool-calls" | undefined {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content-filter":
      return "content-filter";
    case "tool-calls":
      return "tool-calls";
    default:
      return undefined;
  }
} 