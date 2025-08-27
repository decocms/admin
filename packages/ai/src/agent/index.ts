import { StreamOptions, Message, GenerateOptions, AIAgent } from "../types.ts";
import { ModelMessage, streamText } from 'ai-v5';
import { createLLMInstance, LLMConfig } from "./llm.ts";
import { DEFAULT_MODEL } from '@deco/sdk';

export interface AIAgentContext {
  envs: Record<string, string>
}

import { experimental_transcribe as transcribe } from 'ai-v5';
import { openai } from '@ai-sdk-v5/openai';

const messageToModelMessage = async (message: Message): Promise<ModelMessage> => {
  if ('audioBase64' in message) {
    // Handle AudioMessage - convert to user message with audio content
    // For now, we'll treat audio as text content since ModelMessage doesn't support audio directly
    // In a real implementation, you might want to transcribe the audio first
    const transcript = await transcribe({
      model: openai.transcription('whisper-1'),
      audio: message.audioBase64,
    })
    return {
      role: 'user',
      content: transcript.text,
    };
  }

  // Handle regular AIMessage
  const aiMessage = message;

  switch (aiMessage.role) {
    case 'system':
      return {
        role: 'system',
        content: aiMessage.content,
      };

    case 'user':
      return {
        role: 'user',
        content: aiMessage.content,
      };

    case 'assistant':
      return {
        role: 'assistant',
        content: aiMessage.content,
      };

    case 'data':
      // 'data' role is deprecated in AIMessage, treat as assistant
      return {
        role: 'assistant',
        content: aiMessage.content,
      };

    default:
      // Fallback to user role for any unknown roles
      return {
        role: 'user',
        content: aiMessage.content,
      };
  }
};
export const stream = (ctx: AIAgentContext) => async (messages: Message[], options?: StreamOptions): Promise<Response> => {
  const createModelOptions = {
    envs: ctx.envs,
    model: options?.model ?? DEFAULT_MODEL.id,
    ...options
  }
  const { llmV5: model, tokenLimit } = createLLMInstance(createModelOptions)
  if (!model) {
    throw new Error(`Model ${options?.model} not found`)
  }
  const result = await streamText({
    model,
    messages: messages.map(messageToModelMessage),
    stream: true,
  })
  return result.toDataStreamResponse()
}

export const Agent = {
  create: (ctx: AIAgentContext): Pick<AIAgent, 'stream'> => {
    return {
      stream: stream(ctx),
    }
  }
}