import type {
  GlobalTools,
  MCPClientFetchStub,
  ToolBinder,
  ProjectTools,
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
    forLocator: <TDefinition extends readonly ToolBinder[] = ProjectTools>(
      locator: ProjectLocator,
      integrationId?: string,
    ) => MCPClientFetchStub<TDefinition>;
    forConnection: <TDefinition extends readonly ToolBinder[]>(
      connection: MCPConnection,
    ) => MCPClientFetchStub<TDefinition>;
  },
  {
    get(_, name) {
      if (name === "forLocator") {
        return <TDefinition extends readonly ToolBinder[] = ProjectTools>(
          locator: ProjectLocator,
        ) => createMCPFetchStub<TDefinition>({ workspace: locator });
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
