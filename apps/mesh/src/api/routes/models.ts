import { Hono } from "hono";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { MeshContext } from "../../core/mesh-context";
import { OrganizationTools } from "../../tools";
import type { MCPConnection } from "../../storage/types";
import { AccessControl } from "../../core/access-control";

const app = new Hono<{ Variables: { meshContext: MeshContext } }>();

function ensureOrganization(ctx: MeshContext, orgSlug: string) {
  if (!ctx.organization) {
    throw new Error("Organization context is required");
  }

  if (ctx.organization.slug !== orgSlug) {
    throw new Error("Organization slug mismatch");
  }

  return ctx.organization;
}

async function getBindingConnection(
  ctx: MeshContext,
  organizationId: string,
): Promise<MCPConnection | null> {
  const settings = await OrganizationTools.ORGANIZATION_SETTINGS_GET.execute(
    { organizationId },
    ctx,
  );

  if (!settings.modelsBindingConnectionId) {
    return null;
  }

  const connection = await ctx.storage.connections.findById(
    settings.modelsBindingConnectionId,
  );

  if (!connection) {
    return null;
  }

  if (connection.organizationId !== organizationId) {
    throw new Error("Configured MODELS binding does not belong to organization");
  }

  if (connection.status !== "active") {
    throw new Error(
      `Configured MODELS binding connection is ${connection.status.toUpperCase()}`,
    );
  }

  return connection;
}

async function authorizeConnectionTool(
  ctx: MeshContext,
  connectionId: string,
  toolName: string,
) {
  const accessControl = new AccessControl(
    ctx.authInstance,
    ctx.auth.user?.id ?? ctx.auth.apiKey?.userId,
    toolName,
    ctx.auth.apiKey?.permissions,
    ctx.auth.user?.role,
    connectionId,
  );

  await accessControl.check(toolName);
}

function buildConnectionHeaders(connection: MCPConnection) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (connection.connectionToken) {
    headers.Authorization = `Bearer ${connection.connectionToken}`;
  }

  if (connection.connectionHeaders) {
    Object.assign(headers, connection.connectionHeaders);
  }

  return headers;
}

async function createConnectionClient(connection: MCPConnection) {
  const headers = buildConnectionHeaders(connection);
  const transport = new StreamableHTTPClientTransport(
    new URL(connection.connectionUrl),
    {
      requestInit: {
        headers,
      },
    },
  );

  const client = new Client({
    name: "mcp-mesh-models",
    version: "1.0.0",
  });

  await client.connect(transport);
  return { client, headers };
}

function extractJsonContent(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }

  const maybeResult = result as {
    content?: Array<{ type: string; text?: string; data?: unknown }>;
    data?: unknown;
  };

  if (Array.isArray(maybeResult.content)) {
    for (const item of maybeResult.content) {
      if (item?.type === "json" && item.data !== undefined) {
        return item.data;
      }
      if (item?.type === "text" && item.text) {
        try {
          return JSON.parse(item.text);
        } catch {
          // ignore parse error and continue
        }
      }
    }
  }

  if (maybeResult.data !== undefined) {
    return maybeResult.data;
  }

  return result;
}

app.get("/:org/models/list", async (c) => {
  const ctx = c.get("meshContext");
  const orgSlug = c.req.param("org");

  try {
    const organization = ensureOrganization(ctx, orgSlug);
    const connection = await getBindingConnection(ctx, organization.id);

    if (!connection) {
      return c.json({ models: [] });
    }

    await authorizeConnectionTool(ctx, connection.id, "MODELS_LIST");

    const { client } = await createConnectionClient(connection);
    try {
      const result = await client.callTool({
        name: "MODELS_LIST",
        arguments: {},
      });

      const data = extractJsonContent(result) as { models?: unknown } | undefined;
      return c.json({ models: data?.models ?? [] });
    } finally {
      await client.close?.();
    }
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

app.get("/:org/models/stream-endpoint", async (c) => {
  const ctx = c.get("meshContext");
  const orgSlug = c.req.param("org");

  try {
    const organization = ensureOrganization(ctx, orgSlug);
    const connection = await getBindingConnection(ctx, organization.id);

    if (!connection) {
      return c.json({ url: null });
    }

    await authorizeConnectionTool(ctx, connection.id, "GET_STREAM_ENDPOINT");

    const { client } = await createConnectionClient(connection);
    try {
      const result = await client.callTool({
        name: "GET_STREAM_ENDPOINT",
        arguments: {},
      });

      const data = extractJsonContent(result) as { url?: string } | undefined;

      if (!data?.url) {
        throw new Error("MODELS binding did not return a stream URL");
      }

      return c.json({ url: data.url });
    } finally {
      await client.close?.();
    }
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

app.post("/:org/models/stream", async (c) => {
  const ctx = c.get("meshContext");
  const orgSlug = c.req.param("org");

  try {
    const organization = ensureOrganization(ctx, orgSlug);
    const payload = await c.req.json();
    const connection = await getBindingConnection(ctx, organization.id);

    if (!connection) {
      return c.json({ error: "MODELS binding not configured" }, 404);
    }

    await authorizeConnectionTool(ctx, connection.id, "GET_STREAM_ENDPOINT");

    const { client, headers } = await createConnectionClient(connection);
    try {
      const endpointResult = await client.callTool({
        name: "GET_STREAM_ENDPOINT",
        arguments: {},
      });

      const endpointData = extractJsonContent(endpointResult) as
        | { url?: string }
        | undefined;

      if (!endpointData?.url) {
        throw new Error("MODELS binding did not provide a streaming endpoint");
      }

      const streamHeaders = new Headers(headers);
      streamHeaders.set("Content-Type", "application/json");
      streamHeaders.set("Accept", "text/event-stream");

      const upstreamResponse = await fetch(endpointData.url, {
        method: "POST",
        headers: streamHeaders,
        body: JSON.stringify(payload),
        signal: c.req.raw.signal,
      });

      if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
        const text = await upstreamResponse.text();
        return c.json(
          {
            error: "Streaming request failed",
            detail: text,
          },
          upstreamResponse.status,
        );
      }

      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set("Cache-Control", "no-cache");

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } finally {
      await client.close?.();
    }
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

export default app;
