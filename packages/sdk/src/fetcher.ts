import {
  API_HEADERS,
  getTraceDebugId,
  LEGACY_API_SERVER_URL,
} from "./constants.ts";
import type {
  GlobalTools,
  MCPClientFetchStub,
  ToolBinder,
  WorkspaceTools,
} from "./mcp/index.ts";
import { createMCPFetchStub } from "./mcp/stub.ts";
import { MCPConnection } from "./models/mcp.ts";

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

// Default fetcher instance with API_SERVER_URL and API_HEADERS
export const fetchAPI = createFetcher();
const global = createMCPFetchStub<GlobalTools>({});
export const MCPClient = new Proxy(
  {} as typeof global & {
    forWorkspace: (workspace: string) => MCPClientFetchStub<WorkspaceTools>;
    forConnection: <TDefinition extends readonly ToolBinder[]>(
      connection: MCPConnection,
    ) => MCPClientFetchStub<TDefinition>;
  },
  {
    get(_, name) {
      if (name === "forWorkspace") {
        return (workspace: string) =>
          createMCPFetchStub<WorkspaceTools>({ workspace });
      }
      if (name === "forConnection") {
        return <TDefinition extends readonly ToolBinder[]>(
          connection: MCPConnection,
        ) => createMCPFetchStub<TDefinition>({ connection });
      }
      return global[name as keyof typeof global];
    },
  },
);
