export type SSEConnection = {
  type: "SSE";
  url: string;
  token?: string;
  headers?: Record<string, string>;
};

export type WebsocketConnection = {
  type: "Websocket";
  url: string;
  token?: string;
};

export type DecoConnection = {
  type: "Deco";
  tenant: string;
  token?: string;
};

export type InnateConnection = {
  type: "INNATE";
  name: string;
  workspace?: string;
};

export type HTTPConnection = {
  type: "HTTP";
  url: string;
  headers?: Record<string, string>;
  token?: string;
};

export type MCPConnection =
  | SSEConnection
  | WebsocketConnection
  | InnateConnection
  | DecoConnection
  | HTTPConnection;
