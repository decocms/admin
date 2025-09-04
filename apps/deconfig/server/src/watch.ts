import { branchRpcFor } from "server/tools/deconfig.ts";
import { WatchOptions } from "./branch.ts";
import type { Env } from "server/main.ts";

export interface WatchOpts extends WatchOptions {
  branchName?: string;
}
/**
 * Watch a branch and return an SSE stream of changes.
 *
 * @param env - The environment
 * @param options - The options for the watch stream
 * @returns An SSE stream of changes
 */
export const watchSSE = async (env: Env, options?: WatchOpts) => {
  env.DECO_CHAT_REQUEST_CONTEXT.ensureAuthenticated();
  const branch = await branchRpcFor(env, options?.branchName);

  const watchStream = await branch.watch(options);

  // Transform the WatchEvent stream into SSE format
  const sseStream = new ReadableStream({
    start(controller) {
      const reader = watchStream.getReader();

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            // Convert WatchEvent to SSE format
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        }
      };

      pump();
    },

    cancel() {
      // Clean up the original stream
      watchStream.cancel?.();
      watchStream[Symbol.dispose]();
    },
  });

  return new Response(sseStream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*", // Add CORS if needed
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
};
