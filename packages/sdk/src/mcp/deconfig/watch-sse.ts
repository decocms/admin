import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { AppContext } from "../context.ts";
import { branchRpcFor, WELL_KNOWN_PUBLIC_PATHS } from "./api.ts";
import { WatchOptions } from "./branch.ts";

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
export const watchSSE = async (env: AppContext, options?: WatchOpts) => {
  assertHasWorkspace(env);
  let filters = options?.pathFilters ?? options?.pathFilter;
  filters = typeof filters === "string" ? [filters] : filters;
  if (
    WELL_KNOWN_PUBLIC_PATHS.some((p) => filters?.some((f) => f.startsWith(p)))
  ) {
    env.resourceAccess.grant();
  } else {
    await assertWorkspaceResourceAccess(env, "READ_FILE");
  }
  using branch = await branchRpcFor(env, options?.branchName);

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
    },
  });
};
