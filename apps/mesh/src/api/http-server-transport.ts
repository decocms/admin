/**
 * HTTP Server Transport for MCP
 * 
 * Wraps StreamableHTTPServerTransport to work with standard fetch Request/Response
 * Uses fetch-to-node to convert between fetch and Node.js formats
 */

import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toFetchResponse, toReqRes } from "fetch-to-node";

export class HttpServerTransport extends StreamableHTTPServerTransport {
  constructor(
    options?:
      & Omit<StreamableHTTPServerTransportOptions, "sessionIdGenerator">
      & {
        sessionIdGenerator?: () => string;
      },
  ) {
    super({
      ...options,
      sessionIdGenerator: options?.sessionIdGenerator,
    });
  }

  async handleMessage(req: Request): Promise<Response> {
    const { req: nodeReq, res } = toReqRes(req);
    super.handleRequest(nodeReq, res, await req.json().catch(() => null));
    return toFetchResponse(res);
  }
}

