import type { LanguageModelV2StreamPart } from "@ai-sdk/provider";

// Helper to convert the AI SDK stream to a Response
export function streamToResponse(
  stream: ReadableStream<LanguageModelV2StreamPart>,
  headers?: Record<string, string>,
): Response {
  // Transform LanguageModelV2StreamPart objects to newline-delimited JSON
  const encodedStream = stream.pipeThrough(
    new TransformStream<LanguageModelV2StreamPart, Uint8Array>({
      transform(chunk, controller) {
        // Serialize each chunk as JSON with newline delimiter
        const line = JSON.stringify(chunk) + "\n";
        controller.enqueue(new TextEncoder().encode(line));
      },
    }),
  );

  return new Response(encodedStream, {
    headers: {
      "Content-Type": "application/x-ndjson", // newline-delimited JSON
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...headers,
    },
  });
}
