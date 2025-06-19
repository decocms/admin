import { generateObject, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { createTool } from "../context.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import {
  createWalletClient,
  type AIIntegrationGeneration,
  type Transaction,
  WellKnownWallets,
  MicroDollar,
} from "../wallet/index.ts";
import { InternalServerError } from "../../errors.ts";

const getWalletClient = (c: any) => {
  if (!c.envVars.WALLET_API_KEY) {
    throw new InternalServerError("WALLET_API_KEY is not set");
  }
  return createWalletClient(c.envVars.WALLET_API_KEY, c.walletBinding);
};

const checkWalletBalance = async (c: any) => {
  const wallet = getWalletClient(c);
  const workspaceWalletId = WellKnownWallets.build(
    ...WellKnownWallets.workspace.genCredits(c.workspace.value),
  );
  
  const response = await wallet["GET /accounts/:id"]({
    id: encodeURIComponent(workspaceWalletId),
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    console.error("Failed to check balance", response);
    return true; // Allow on error to avoid blocking
  }

  const data = await response.json();
  const balance = MicroDollar.fromMicrodollarString(data.balance);
  return !balance.isNegative() && !balance.isZero();
};

const recordAIUsage = async (c: any, toolName: string, model: string, usage: any, provider: string) => {
  const wallet = getWalletClient(c);
  
  const transaction: AIIntegrationGeneration = {
    type: "AIIntegrationGeneration",
    usage: {
      toolName,
      model,
      usage: {
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        totalTokens: usage.totalTokens || 0,
      },
      workspace: c.workspace.value,
      userId: c.user.id as string,
      provider,
    },
    generatedBy: {
      type: "user",
      id: c.user.id as string,
    },
    vendor: {
      type: "vendor",
      id: c.workspace.value,
    },
    timestamp: new Date(),
  };

  const response = await wallet["POST /transactions"]({}, {
    body: transaction,
  });

  if (!response.ok) {
    console.error("Failed to record AI usage", response);
  }
};

const getAIProvider = (model: string) => {
  if (model.startsWith("anthropic:")) {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    return {
      provider: anthropic,
      modelId: model.replace("anthropic:", ""),
      providerName: "anthropic",
    };
  } else if (model.startsWith("openai:")) {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return {
      provider: openai,
      modelId: model.replace("openai:", ""),
      providerName: "openai",
    };
  } else {
    throw new Error(`Unsupported model: ${model}`);
  }
};

const DEFAULT_MODEL = "anthropic:claude-sonnet-4";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export const AI_GENERATE_TEXT = createTool({
  name: "AI_GENERATE_TEXT",
  description: "Generate text using AI models with wallet billing",
  inputSchema: z.object({
    messages: z.array(MessageSchema),
    model: z.string().optional().default(DEFAULT_MODEL),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    topP: z.number().optional(),
  }),
  handler: async ({ messages, model = DEFAULT_MODEL, maxTokens, temperature, topP }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    // Check wallet balance before making API call
    const hasBalance = await checkWalletBalance(c);
    if (!hasBalance) {
      throw new Error("Insufficient funds");
    }

    try {
      const { provider, modelId, providerName } = getAIProvider(model);
      
      const result = await generateText({
        model: provider(modelId),
        messages,
        maxTokens,
        temperature,
        topP,
      });

      // Record usage after successful generation
      await recordAIUsage(c, "AI_GENERATE_TEXT", model, result.usage, providerName);

      return {
        text: result.text,
        usage: result.usage,
        finishReason: result.finishReason,
      };
    } catch (error) {
      console.error("AI generation failed:", error);
      throw new InternalServerError(
        error instanceof Error ? error.message : "AI generation failed"
      );
    }
  },
});

export const AI_GENERATE_OBJECT = createTool({
  name: "AI_GENERATE_OBJECT",
  description: "Generate structured objects using AI models with wallet billing",
  inputSchema: z.object({
    messages: z.array(MessageSchema),
    schema: z.record(z.any()).describe("JSON Schema for the output object"),
    model: z.string().optional().default(DEFAULT_MODEL),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    topP: z.number().optional(),
  }),
  handler: async ({ messages, schema, model = DEFAULT_MODEL, maxTokens, temperature, topP }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    // Check wallet balance before making API call
    const hasBalance = await checkWalletBalance(c);
    if (!hasBalance) {
      throw new Error("Insufficient funds");
    }

    try {
      const { provider, modelId, providerName } = getAIProvider(model);
      
      const result = await generateObject({
        model: provider(modelId),
        messages,
        schema: z.object(schema),
        maxTokens,
        temperature,
        topP,
      });

      // Record usage after successful generation
      await recordAIUsage(c, "AI_GENERATE_OBJECT", model, result.usage, providerName);

      return {
        object: result.object,
        usage: result.usage,
        finishReason: result.finishReason,
      };
    } catch (error) {
      console.error("AI object generation failed:", error);
      throw new InternalServerError(
        error instanceof Error ? error.message : "AI object generation failed"
      );
    }
  },
});