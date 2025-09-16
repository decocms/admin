// Durable Object sometimes gets reset during a deploy, so we need to retry
// the operation if it fails.
// deno-lint-ignore no-explicit-any
export const doRetryable = <T, TArgs extends any[] = any[]>(
  fn: (...args: TArgs) => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): (...args: TArgs) => Promise<T> => {
  return async (...args: TArgs) => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;

        // Only retry if it's the last attempt or if the error is retryable
        if (
          attempt === maxRetries ||
          !error ||
          typeof error !== "object" ||
          !("retryable" in error) ||
          !error.retryable
        ) {
          break;
        }

        // Exponential backoff: delay = baseDelay * 2^attempt + jitter
        const delay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * delay; // Add up to 10% jitter
        const totalDelay = delay + jitter;

        await new Promise((resolve) => setTimeout(resolve, totalDelay));
      }
    }

    throw lastError;
  };
};
