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

/**
 * Lazy promise wrapper that defers execution until the promise is awaited.
 * The factory function is only called when .then() is invoked for the first time.
 */
class Lazy<T> implements PromiseLike<T> {
  private promise: Promise<T> | null = null;

  constructor(private factory: () => Promise<T>) {}

  private getOrCreatePromise(): Promise<T> {
    if (!this.promise) {
      this.promise = this.factory();
    }
    return this.promise;
  }

  // eslint-disable-next-line no-thenable
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    return this.getOrCreatePromise().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: unknown) => TResult | PromiseLike<TResult>)
      | null
      | undefined,
  ): Promise<T | TResult> {
    return this.getOrCreatePromise().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null | undefined): Promise<T> {
    return this.getOrCreatePromise().finally(onfinally);
  }
}

/**
 * Creates a lazy promise that only executes when awaited.
 *
 * @param factory - A function that returns a Promise<T>
 * @returns A Promise-like object that defers execution until .then() is called
 *
 * @example
 * ```ts
 * const lazyData = lazy(() => fetchExpensiveData());
 * // fetchExpensiveData() is NOT called yet
 *
 * const result = await lazyData;
 * // fetchExpensiveData() is called NOW
 * ```
 */
export function lazy<T>(factory: () => Promise<T>): Promise<T> {
  return new Lazy(factory) as unknown as Promise<T>;
}
