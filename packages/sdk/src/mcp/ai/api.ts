import { z } from "zod";
import { type JSONSchema7 } from "@ai-sdk/provider";
import { assertHasWorkspace, assertWorkspaceResourceAccess } from "../assertions.ts";
import { createTool, type AppContext } from "../context.ts";
import type { Message } from "ai";

// Group name for AI integration tools
export const AI_INTEGRATION_GROUP = "AI Integration";

// Default model for AI integration (Claude-4 as specified in requirements)
const DEFAULT_AI_MODEL = "anthropic:claude-sonnet-4";

// Input schemas
const GenerateTextInputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
    id: z.string().optional(),
  })).describe("Array of messages for the AI conversation"),
  model: z.string().optional().describe(`The model to use for generation. Defaults to ${DEFAULT_AI_MODEL}`),
  instructions: z.string().optional().describe("Additional instructions for the AI"),
  maxTokens: z.number().optional().describe("Maximum number of tokens to generate"),
  maxSteps: z.number().optional().describe("Maximum number of steps for the AI to take"),
});

const GenerateObjectInputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
    id: z.string().optional(),
  })).describe("Array of messages for the AI conversation"),
  schema: z.any().describe("JSON Schema for the expected output object"),
  model: z.string().optional().describe(`The model to use for generation. Defaults to ${DEFAULT_AI_MODEL}`),
  instructions: z.string().optional().describe("Additional instructions for the AI"),
  maxTokens: z.number().optional().describe("Maximum number of tokens to generate"),
  maxSteps: z.number().optional().describe("Maximum number of steps for the AI to take"),
});

// Output schemas
const GenerateTextOutputSchema = z.object({
  text: z.string().describe("The generated text response"),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }).describe("Token usage information"),
  finishReason: z.string().optional().describe("Reason why generation finished"),
});

const GenerateObjectOutputSchema = z.object({
  object: z.any().describe("The generated object matching the provided schema"),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }).describe("Token usage information"),
  finishReason: z.string().optional().describe("Reason why generation finished"),
});

/**
 * Helper function to create an AI agent stub for the current workspace
 */
async function createAIAgentStub(c: AppContext) {
  const { AIAgent } = await import("@deco/ai/actors");
  
  // Create a temporary agent ID for this AI call
  const tempAgentId = `${c.workspace!.value}/ai-integration-${crypto.randomUUID()}`;
  
  return c.stub(AIAgent).new(tempAgentId);
}

/**
 * Generate text using AI integration
 */
export const generateText = createTool({
  name: "AI_GENERATE_TEXT",
  description: "Generate text using AI integration. This tool allows you to process AI tasks with flexible model selection while consuming credits from the current workspace.",
  group: AI_INTEGRATION_GROUP,
  inputSchema: GenerateTextInputSchema,
  outputSchema: GenerateTextOutputSchema,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool!.name, c);

    const {
      messages,
      model = DEFAULT_AI_MODEL,
      instructions,
      maxTokens,
      maxSteps,
    } = props;

    // Convert messages to the AI SDK format
    const aiMessages: Message[] = messages.map(msg => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
      id: msg.id || crypto.randomUUID(),
    }));

    try {
      // Create AI agent stub
      const agent = await createAIAgentStub(c);

      // Generate text using the agent's generate method
      const result = await agent.generate(aiMessages, {
        model,
        instructions,
        maxTokens,
        maxSteps,
        threadId: crypto.randomUUID(),
        resourceId: crypto.randomUUID(),
      });

      return {
        text: result.text,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
        finishReason: result.finishReason,
      };
    } catch (error) {
      throw new Error(`AI text generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});

/**
 * Generate structured object using AI integration
 */
export const generateObject = createTool({
  name: "AI_GENERATE_OBJECT",
  description: "Generate structured objects using AI integration. This tool extracts structured data from inputs using AI while consuming credits from the current workspace.",
  group: AI_INTEGRATION_GROUP,
  inputSchema: GenerateObjectInputSchema,
  outputSchema: GenerateObjectOutputSchema,
  handler: async (props, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool!.name, c);

    const {
      messages,
      schema,
      model = DEFAULT_AI_MODEL,
      instructions,
      maxTokens,
      maxSteps,
    } = props;

    // Convert messages to the AI SDK format
    const aiMessages: Message[] = messages.map(msg => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
      id: msg.id || crypto.randomUUID(),
    }));

    try {
      // Create AI agent stub
      const agent = await createAIAgentStub(c);

      // Validate that schema is a proper JSON Schema
      let jsonSchema: JSONSchema7;
      if (typeof schema === "object" && schema !== null) {
        jsonSchema = schema as JSONSchema7;
      } else {
        throw new Error("Invalid schema provided. Must be a valid JSON Schema object.");
      }

      // Generate object using the agent's generateObject method
      const result = await agent.generateObject(aiMessages, jsonSchema);

      return {
        object: result.object,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
        finishReason: result.finishReason,
      };
    } catch (error) {
      throw new Error(`AI object generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});

/**
 * List available AI models for the workspace
 */
export const listModels = createTool({
  name: "AI_LIST_MODELS",
  description: "List available AI models that can be used for AI integration tasks",
  group: AI_INTEGRATION_GROUP,
  inputSchema: z.object({}),
  outputSchema: z.object({
    models: z.array(z.object({
      id: z.string(),
      name: z.string(),
      provider: z.string(),
      capabilities: z.array(z.string()),
      isDefault: z.boolean(),
    })),
    defaultModel: z.string(),
  }),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool!.name, c);

    // Import constants to get available models
    const { WELL_KNOWN_MODELS } = await import("../../constants.ts");

    const models = WELL_KNOWN_MODELS
      .filter(model => model.isEnabled)
      .map(model => ({
        id: model.id,
        name: model.name,
        provider: model.id.split(":")[0],
        capabilities: model.capabilities,
        isDefault: model.id === DEFAULT_AI_MODEL,
      }));

    return {
      models,
      defaultModel: DEFAULT_AI_MODEL,
    };
  },
});