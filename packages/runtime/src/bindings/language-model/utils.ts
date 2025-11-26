import { LanguageModelV2StreamPart } from "@ai-sdk/provider";

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

export function responseToStream(
  response: Response,
): ReadableStream<LanguageModelV2StreamPart> {
  if (!response.body) {
    throw new Error("Response body is null");
  }

  return response.body.pipeThrough(new TextDecoderStream()).pipeThrough(
    new TransformStream<string, LanguageModelV2StreamPart>({
      transform(chunk, controller) {
        // Split by newlines and parse each line
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line) as LanguageModelV2StreamPart;
              controller.enqueue(parsed);
            } catch (error) {
              console.error("Failed to parse stream chunk:", error);
            }
          }
        }
      },
    }),
  );
}
