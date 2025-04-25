import type { Actor } from "@deco/actors";
import { actors } from "@deco/actors/stub";
import { API_SERVER_URL } from "./constants.ts";
import { getTraceDebugId } from "./constants.ts";

/**
 * A utility to create a stub for an actor.
 *
 * @param name - The name of the actor.
 * @returns A stub for the actor.
 */
export const stub = <T extends Actor>(name: string) => {
  return actors.stub<T>(
    name,
    {
      server: {
        credentials: "include",
        url: API_SERVER_URL,
      },
      maxWsChunkSize: 768e3, // 768kb to make a message binary.
      errorHandling: {
        [DOMException.name]: DOMException,
        // TODO: do we  need this?
        // "ErrnoError": ErrnoError,
        // [ErrnoError.name]: ErrnoError,
      },
      fetcher: {
        fetch: (url, options) => {
          if (url instanceof Request) {
            url.headers.set("x-trace-debug-id", getTraceDebugId());
            return fetch(url, options);
          }

          return fetch(url, {
            ...options,
            headers: {
              ...(options?.headers as HeadersInit || {}),
              "x-trace-debug-id": getTraceDebugId(),
            },
          });
        },
        createWebSocket: (url) => {
          return new WebSocket(url);
        },
      },
    },
  );
};
