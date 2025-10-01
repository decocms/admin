import type {
  GlobalTools,
  MCPClientFetchStub,
  ProjectTools,
  ToolBinder,
} from "./mcp/index.ts";
import { createMCPFetchStub } from "./mcp/stub.ts";
import type { MCPConnection } from "./models/mcp.ts";
import { ProjectLocator } from "./locator.ts";

export interface FetchOptions extends RequestInit {
  path?: string;
  segments?: string[];
}

// Default fetcher instance with API_SERVER_URL and API_HEADERS
const global = createMCPFetchStub<GlobalTools>({});
export const MCPClient = new Proxy(
  {} as typeof global & {
    forLocator: (
      locator: ProjectLocator,
      integrationId?: string,
    ) => MCPClientFetchStub<ProjectTools>;
    forConnection: <TDefinition extends readonly ToolBinder[]>(
      connection: MCPConnection,
    ) => MCPClientFetchStub<TDefinition>;
  },
  {
    get(_, name) {
      if (name === "forLocator") {
        return (locator: ProjectLocator) =>
          createMCPFetchStub<ProjectTools>({ workspace: locator });
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
