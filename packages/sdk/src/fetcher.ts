import {
  API_HEADERS,
  API_SERVER_URL,
  getTraceDebugId,
  LEGACY_API_SERVER_URL,
} from "./constants.ts";

export interface FetchOptions extends RequestInit {
  path?: string;
  segments?: string[];
}

/**
 * Creates a fetch function with pre-configured headers and base URL
 * @param baseUrl - The base URL for the API
 * @param defaultHeaders - Default headers to include in every request
 * @returns A configured fetch function
 */
export function createFetcher(
  baseUrl: string = LEGACY_API_SERVER_URL,
  defaultHeaders: HeadersInit = API_HEADERS,
) {
  return function fetchAPI(options: FetchOptions = {}) {
    const { path, segments, ...init } = options;

    // Construct the URL
    const url = new URL(
      path || (segments ? segments.join("/") : ""),
      baseUrl,
    );

    // Merge headers
    const headers = {
      ...defaultHeaders,
      ...init.headers,
      "x-trace-debug-id": getTraceDebugId(),
    };

    return fetch(url, {
      ...init,
      credentials: "include",
      headers,
    });
  };
}

export const callToolFor = (
  workspace: string,
  name: string,
  args: Record<string, unknown>,
  init: RequestInit = {},
) =>
  fetch(
    new URL(
      `${workspace}/tools/call/${name}`.split("/").filter(Boolean).join("/"),
      API_SERVER_URL,
    ),
    {
      body: JSON.stringify(args),
      method: "POST",
      credentials: "include",
      ...init,
      headers: {
        ...init.headers,
        "x-trace-debug-id": getTraceDebugId(),
      },
    },
  );

export const callTool = (
  name: string,
  args: Record<string, unknown>,
  init: RequestInit = {},
) => callToolFor("", name, args, init);

// Default fetcher instance with API_SERVER_URL and API_HEADERS
export const fetchAPI = createFetcher();
