import { assertEquals, assertExists } from "@std/assert";
import { TRANSCRIBE_AUDIO } from "./tools.ts";

// Mock agent for testing
const createMockAgent = (hasVoice: boolean = true, shouldFailTranscription: boolean = false) => ({
  voice: hasVoice ? {
    listen: async () => {
      if (shouldFailTranscription) {
        throw new Error("Transcription failed");
      }
      return "Hello, this is a test transcription";
    }
  } : null,
  workspace: "test-workspace",
  configuration: () => Promise.resolve({ id: "test-agent", model: "test-model" }),
});

// Valid base64 audio data (small sample)
const validBase64Audio = "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodzF";

// Invalid base64 data
const invalidBase64Audio = "not-valid-base64!@#$%";

// Large base64 data (simulated - just repeat to make it large)
const largeBase64Audio = validBase64Audio.repeat(1000000); // Simulate large file

Deno.test("TRANSCRIBE_AUDIO - validates base64 input format", async () => {
  const mockAgent = createMockAgent();
  const tool = TRANSCRIBE_AUDIO;
  
  // Test with valid base64
  const validResult = await tool.execute(mockAgent, undefined)({
    context: { audioBase64: validBase64Audio }
  });
  
  assertEquals(validResult.success, true);
  assertExists(validResult.transcription);
  assertEquals(validResult.transcription, "Hello, this is a test transcription");
});

Deno.test("TRANSCRIBE_AUDIO - rejects invalid base64 format", async () => {
  const mockAgent = createMockAgent();
  const tool = TRANSCRIBE_AUDIO;
  
  const result = await tool.execute(mockAgent, undefined)({
    context: { audioBase64: invalidBase64Audio }
  });
  
  assertEquals(result.success, false);
  assertEquals(result.transcription, "");
  assertEquals(result.message, "Invalid base64 format in audioBase64");
});

Deno.test("TRANSCRIBE_AUDIO - rejects empty audio data", async () => {
  const mockAgent = createMockAgent();
  const tool = TRANSCRIBE_AUDIO;
  
  const result = await tool.execute(mockAgent, undefined)({
    context: { audioBase64: "" }
  });
  
  assertEquals(result.success, false);
  assertEquals(result.transcription, "");
  assertEquals(result.message, "Invalid audio data: audioBase64 must be a non-empty string");
});

Deno.test("TRANSCRIBE_AUDIO - handles missing voice capabilities", async () => {
  const mockAgent = createMockAgent(false); // Agent without voice
  const tool = TRANSCRIBE_AUDIO;
  
  const result = await tool.execute(mockAgent, undefined)({
    context: { audioBase64: validBase64Audio }
  });
  
  assertEquals(result.success, false);
  assertEquals(result.transcription, "");
  assertEquals(result.message, "Voice transcription is not available for this agent. Ensure OpenAI API key is configured.");
});

Deno.test("TRANSCRIBE_AUDIO - handles transcription errors gracefully", async () => {
  const mockAgent = createMockAgent(true, true); // Agent with voice but failing transcription
  const tool = TRANSCRIBE_AUDIO;
  
  const result = await tool.execute(mockAgent, undefined)({
    context: { audioBase64: validBase64Audio }
  });
  
  assertEquals(result.success, false);
  assertEquals(result.transcription, "");
  assertEquals(result.message, "Transcription failed: Transcription failed");
});

Deno.test("TRANSCRIBE_AUDIO - includes language parameter in success message", async () => {
  const mockAgent = createMockAgent();
  const tool = TRANSCRIBE_AUDIO;
  
  const result = await tool.execute(mockAgent, undefined)({
    context: { 
      audioBase64: validBase64Audio,
      language: "pt"
    }
  });
  
  assertEquals(result.success, true);
  assertEquals(result.transcription, "Hello, this is a test transcription");
  assertEquals(result.message.includes("with language hint: pt"), true);
});

Deno.test("TRANSCRIBE_AUDIO - estimates file size in success message", async () => {
  const mockAgent = createMockAgent();
  const tool = TRANSCRIBE_AUDIO;
  
  const result = await tool.execute(mockAgent, undefined)({
    context: { audioBase64: validBase64Audio }
  });
  
  assertEquals(result.success, true);
  assertEquals(result.message.includes("Successfully transcribed audio"), true);
  assertEquals(result.message.includes("KB"), true);
});

Deno.test("TRANSCRIBE_AUDIO - has correct schema structure", () => {
  const tool = TRANSCRIBE_AUDIO;
  
  // Check tool properties
  assertEquals(tool.id, "TRANSCRIBE_AUDIO");
  assertExists(tool.description);
  assertExists(tool.inputSchema);
  assertExists(tool.outputSchema);
  assertExists(tool.execute);
  
  // Check description contains key information
  assertEquals(tool.description.includes("OpenAI Whisper"), true);
  assertEquals(tool.description.includes("base64"), true);
  assertEquals(tool.description.includes("25MB"), true);
});