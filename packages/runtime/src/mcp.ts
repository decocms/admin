/* oxlint-disable no-explicit-any */
import { z } from "zod";
import type { MCPConnection } from "./connection.ts";
import { createMCPClientProxy } from "./proxy.ts";
import type { ToolBinder } from "@decocms/bindings";
export {
  createMCPFetchStub,
  isStreamableToolBinder,
  MCPClient,
  type CreateStubAPIOptions,
  type MCPClientFetchStub,
  type MCPClientStub,
} from "@decocms/bindings/client"; // Default fetcher instance with API_SERVER_URL and API_HEADERS

export type { ToolBinder };
