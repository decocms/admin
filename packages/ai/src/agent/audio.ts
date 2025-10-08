import {
  UIMessage,
  experimental_transcribe as transcribe,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { Buffer } from "node:buffer";
import type { AudioMessage } from "../types.ts";

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

export function isAudioMessage(message: UIMessage): message is AudioMessage {
  return "audioBase64" in message && typeof message.audioBase64 === "string";
}

/**
 * Transcribe audio from a UIMessage if it contains audio
 * @param message - The UIMessage that might contain audio
 * @param apiKey - OpenAI API key for transcription
 * @returns The transcription text or null if no audio
 */
export async function transcribeAudioMessage(
  message: UIMessage,
  apiKey: string,
): Promise<string | null> {
  if (!isAudioMessage(message)) {
    return null;
  }

  return await transcribeBase64Audio({
    audio: message.audioBase64,
    apiKey,
  });
}

/**
 * Get the audio transcription of the given audio base64 using AI SDK 5
 * @param audio - The audio base64 string to get the transcription of
 * @param apiKey - OpenAI API key for transcription
 * @returns The transcription of the audio stream
 */
export async function transcribeBase64Audio({
  audio,
  apiKey,
}: {
  audio: string;
  apiKey: string;
}): Promise<string> {
  const buffer = Buffer.from(audio, "base64");
  if (buffer.length > MAX_AUDIO_SIZE) {
    throw new Error("Audio size exceeds the maximum allowed size");
  }
  const openai = createOpenAI({ apiKey });

  // Use AI SDK 5's experimental_transcribe function
  const result = await transcribe({
    model: openai.transcription(DEFAULT_SPEECH_TO_TEXT_MODEL),
    audio: buffer,
  });

  return result.text;
}

const DEFAULT_TEXT_TO_SPEECH_MODEL = "tts-1";
const DEFAULT_SPEECH_TO_TEXT_MODEL = "whisper-1";

/**
 * Generate speech audio from text using AI SDK 5
 * @param text - The text to convert to speech
 * @param apiKey - OpenAI API key for speech generation
 * @param options - Optional voice and speed settings
 * @returns The generated audio as Uint8Array
 */
export async function generateSpeechFromText({
  text,
  apiKey,
  options = {},
}: {
  text: string;
  apiKey: string;
  options?: {
    voice?: string;
    speed?: number;
  };
}): Promise<Uint8Array> {
  const openai = createOpenAI({ apiKey });

  const result = await generateSpeech({
    model: openai.speech(DEFAULT_TEXT_TO_SPEECH_MODEL),
    text,
    voice: options.voice || "alloy",
    speed: options.speed || 1.0,
  });

  return result.audio.uint8Array;
}

/**
 * Create a voice handler for the agent using AI SDK 5
 * @param apiKey - OpenAI API key
 * @returns Voice handler object with speak and listen methods
 */
export function createAgentOpenAIVoice({ apiKey }: { apiKey: string }) {
  const openai = createOpenAI({ apiKey });

  return {
    async speak(text: string, options?: { voice?: string; speed?: number }) {
      return await generateSpeechFromText({
        text,
        apiKey,
        options: {
          voice: options?.voice || "alloy",
          speed: options?.speed || 1.0,
        },
      });
    },
    async listen(audioBuffer: Uint8Array): Promise<string> {
      const result = await transcribe({
        model: openai.transcription(DEFAULT_SPEECH_TO_TEXT_MODEL),
        audio: audioBuffer,
      });
      return result.text;
    },
  };
}
