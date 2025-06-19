import { z } from "zod";
import { createTool } from "../context.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createWalletClient } from "../wallet/index.ts";
import { getPlan } from "../wallet/api.ts";

export const AI_INTEGRATION_GROUP = "ai-integration";

// Input schemas for the AI integration tools
const GenerateTextInputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })).describe("Array of messages to process"),
  model: z.string().optional().describe("Model to use (defaults to Claude Sonnet 4)"),
  instructions: z.string().optional().describe("System instructions for the model"),
  maxTokens: z.number().optional().describe("Maximum tokens to generate"),
  temperature: z.number().optional().describe("Temperature for generation"),
});

const GenerateObjectInputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })).describe("Array of messages to process"),
  schema: z.any().describe("JSON schema for the expected output object"),
  model: z.string().optional().describe("Model to use (defaults to Claude Sonnet 4)"),
  instructions: z.string().optional().describe("System instructions for the model"),
  maxTokens: z.number().optional().describe("Maximum tokens to generate"),
  temperature: z.number().optional().describe("Temperature for generation"),
});

// Default model configuration
const DEFAULT_AI_MODEL = "anthropic:claude-sonnet-4";

// Helper function to handle billing for AI usage
const handleAIUsage = async (
  c: any,
  usage: { promptTokens: number; completionTokens: number; totalTokens: number },
  model: string,
  modelId: string,
) => {
  const wallet = createWalletClient(c.envVars.WALLET_API_KEY, c.walletBinding);
  const plan = await getPlan(c);
  
  // Create AI generation transaction similar to agent execution
  const operation = {
    type: "AIIntegrationGeneration" as const,
    usage: {
      usage,
      model,
      modelId,
      workspace: c.workspace.value,
      threadId: crypto.randomUUID(), // Generate unique thread ID for each AI call
    },
    generatedBy: {
      type: "user" as const,
      id: c.user?.id || "unknown",
    },
    vendor: {
      type: "vendor" as const,
      id: c.workspace.value,
    },
    payer: plan.id === "trial"
      ? {
        type: "wallet" as const,
        id: `workspace:${c.workspace.value}:trial-credits`,
      }
      : undefined,
    metadata: {
      model,
      modelId,
      workspace: c.workspace.value,
      ...usage,
    },
    timestamp: new Date(),
  };

  const response = await wallet["POST /transactions"]({}, {
    body: operation,
  });

  if (!response.ok) {
    console.error("Failed to track AI usage billing");
  }
};

// Check if user has sufficient funds
const checkFunds = async (c: any): Promise<boolean> => {
  const wallet = createWalletClient(c.envVars.WALLET_API_KEY, c.walletBinding);
  
  const workspaceWalletId = `workspace:${c.workspace.value}:gen-credits`;
  const response = await wallet["GET /accounts/:id"]({
    id: encodeURIComponent(workspaceWalletId),
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    console.error("Failed to check balance", response);
    return true; // Assume they have balance on error
  }

  const data = await response.json();
  const balanceStr = data.balance;
  
  // Simple check if balance is positive (not zero or negative)
  return balanceStr && balanceStr !== "0" && !balanceStr.startsWith("-");
};

export const generateTextTool = createTool({
  name: "AI_GENERATE_TEXT",
  description: "Generate text using AI models with the same signature as Vercel AI SDK",
  inputSchema: GenerateTextInputSchema,
  outputSchema: z.object({
    text: z.string().describe("Generated text response"),
    usage: z.object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    }).describe("Token usage information"),
  }),
  handler: async ({
    messages,
    model = DEFAULT_AI_MODEL,
    instructions,
    maxTokens = 4096,
    temperature = 0.7,
  }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    // Check if user has sufficient funds
    const hasFunds = await checkFunds(c);
    if (!hasFunds) {
      throw new Error("Insufficient funds for AI generation");
    }

    try {
      // Convert messages to AI SDK format
      const aiMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add system instructions if provided
      const finalMessages = instructions 
        ? [{ role: "system" as const, content: instructions }, ...aiMessages]
        : aiMessages;

      // Parse model provider and name
      const [provider, modelName] = model.split(':');
      
      let response;
      let apiKey;
      let baseUrl;

      // Configure API based on provider
      switch (provider) {
        case 'anthropic':
          apiKey = c.envVars.ANTHROPIC_API_KEY;
          baseUrl = 'https://api.anthropic.com/v1/messages';
          
          response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: maxTokens,
              messages: finalMessages,
              temperature,
            }),
          });
          break;
          
        case 'openai':
          apiKey = c.envVars.OPENAI_API_KEY;
          baseUrl = 'https://api.openai.com/v1/chat/completions';
          
          response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: maxTokens,
              messages: finalMessages,
              temperature,
            }),
          });
          break;
          
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }

      if (!response.ok) {
        throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract response based on provider
      let text: string;
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number };
      
      if (provider === 'anthropic') {
        text = data.content?.[0]?.text || '';
        usage = {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        };
      } else if (provider === 'openai') {
        text = data.choices?.[0]?.message?.content || '';
        usage = {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        };
      } else {
        throw new Error(`Unsupported provider for response parsing: ${provider}`);
      }

      // Handle billing
      await handleAIUsage(c, {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      }, model, model);

      return {
        text,
        usage,
      };
    } catch (error) {
      console.error("AI text generation error:", error);
      throw new Error(`AI text generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});

export const generateObjectTool = createTool({
  name: "AI_GENERATE_OBJECT",
  description: "Generate structured objects using AI models with the same signature as Vercel AI SDK",
  inputSchema: GenerateObjectInputSchema,
  outputSchema: z.object({
    object: z.any().describe("Generated structured object"),
    usage: z.object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    }).describe("Token usage information"),
  }),
  handler: async ({
    messages,
    schema,
    model = DEFAULT_AI_MODEL,
    instructions,
    maxTokens = 4096,
    temperature = 0.7,
  }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    // Check if user has sufficient funds
    const hasFunds = await checkFunds(c);
    if (!hasFunds) {
      throw new Error("Insufficient funds for AI generation");
    }

    try {
      // Convert messages to AI SDK format
      const aiMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add system instructions for structured output
      const schemaInstructions = `You must respond with valid JSON that matches this schema: ${JSON.stringify(schema)}`;
      const systemMessage = instructions 
        ? `${instructions}\n\n${schemaInstructions}`
        : schemaInstructions;
      
      const finalMessages = [
        { role: "system" as const, content: systemMessage },
        ...aiMessages
      ];

      // Parse model provider and name
      const [provider, modelName] = model.split(':');
      
      let response;
      let apiKey;
      let baseUrl;

      // Configure API based on provider
      switch (provider) {
        case 'anthropic':
          apiKey = c.envVars.ANTHROPIC_API_KEY;
          baseUrl = 'https://api.anthropic.com/v1/messages';
          
          response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: maxTokens,
              messages: finalMessages,
              temperature,
            }),
          });
          break;
          
        case 'openai':
          apiKey = c.envVars.OPENAI_API_KEY;
          baseUrl = 'https://api.openai.com/v1/chat/completions';
          
          response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: maxTokens,
              messages: finalMessages,
              temperature,
              response_format: { type: "json_object" },
            }),
          });
          break;
          
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }

      if (!response.ok) {
        throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract response based on provider
      let text: string;
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number };
      
      if (provider === 'anthropic') {
        text = data.content?.[0]?.text || '';
        usage = {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        };
      } else if (provider === 'openai') {
        text = data.choices?.[0]?.message?.content || '';
        usage = {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        };
      } else {
        throw new Error(`Unsupported provider for response parsing: ${provider}`);
      }

      // Parse the JSON object from the response
      let object;
      try {
        object = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response: ${parseError}`);
      }

      // Handle billing
      await handleAIUsage(c, {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      }, model, model);

      return {
        object,
        usage,
      };
    } catch (error) {
      console.error("AI object generation error:", error);
      throw new Error(`AI object generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});