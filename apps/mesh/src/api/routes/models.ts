import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
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
    throw new Error(
      "Configured MODELS binding does not belong to organization",
    );
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
  // Session-based users inherit organization-level access. Authorization
  // enforcement is only needed when acting via API keys which carry scoped permissions.
  if (!ctx.auth.apiKey) {
    return;
  }

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
    ...(connection.connectionHeaders ?? {}),
  };

  if (connection.connectionToken) {
    if (headers.Authorization) {
      headers["x-deco-proxy-token"] = connection.connectionToken;
    } else {
      headers.Authorization = `Bearer ${connection.connectionToken}`;
    }
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

function createProxyStream(
  source: ReadableStream<Uint8Array>,
  meta: { org: string; connectionId: string },
) {
  const decoder = new TextDecoder();
  let loggedPreview = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = source.getReader();

      function push() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }

            if (value) {
              controller.enqueue(value);

              if (!loggedPreview) {
                loggedPreview = true;
                const preview = decoder
                  .decode(value, { stream: false })
                  .slice(0, 500);
                console.info(
                  "[models:stream] Upstream preview",
                  JSON.stringify({
                    org: meta.org,
                    connectionId: meta.connectionId,
                    preview,
                  }),
                );
              }
            }

            push();
          })
          .catch((error) => {
            console.error(
              "[models:stream] Proxy stream read failed",
              JSON.stringify({
                org: meta.org,
                connectionId: meta.connectionId,
                error: error instanceof Error ? error.message : String(error),
              }),
            );
            controller.error(error);
          });
      }

      push();
    },
    cancel(reason) {
      source.cancel?.(reason).catch(() => {});
    },
  });
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

    console.info(
      "[models:list] Calling MODELS_LIST",
      JSON.stringify({
        org: orgSlug,
        connectionId: connection.id,
      }),
    );

    const { client } = await createConnectionClient(connection);
    try {
      const result = await client.callTool({
        name: "MODELS_LIST",
        arguments: {},
      });

      const data = extractJsonContent(result) as
        | { models?: unknown }
        | undefined;

      console.info(
        "[models:list] Received response",
        JSON.stringify({
          org: orgSlug,
          connectionId: connection.id,
          models: Array.isArray(data?.models) ? data?.models.length : 0,
          firstModel: Array.isArray(data?.models) ? data.models[0]?.id : null,
        }),
      );

      return c.json({ models: data?.models ?? [] });
    } finally {
      await client.close?.();
    }
  } catch (error) {
    const err = error as Error;
    console.error(
      "[models:list] Failed",
      JSON.stringify({
        org: orgSlug,
        error: err.message,
      }),
    );
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

      console.info(
        "[models:stream-endpoint] Resolved endpoint",
        JSON.stringify({
          org: orgSlug,
          connectionId: connection.id,
          url: data.url,
          connectionStatus: connection.status,
        }),
      );

      return c.json({ url: data.url });
    } finally {
      await client.close?.();
    }
  } catch (error) {
    const err = error as Error;
    console.error(
      "[models:stream-endpoint] Failed",
      JSON.stringify({
        org: orgSlug,
        error: err.message,
      }),
    );
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

      const payloadSummary = {
        model: payload?.model,
        stream: payload?.stream,
        messages: Array.isArray(payload?.messages)
          ? payload.messages.length
          : 0,
      };

      console.info(
        "[models:stream] Proxying request",
        JSON.stringify({
          org: orgSlug,
          connectionId: connection.id,
          url: endpointData.url,
          payload: payloadSummary,
          headers: {
            hasAuthorization: Boolean(headers.Authorization),
            forwardedKeys: Object.keys(headers),
          },
        }),
      );

      const streamHeaders = new Headers(headers);
      streamHeaders.delete("x-deco-proxy-token");
      streamHeaders.set("Content-Type", "application/json");
      streamHeaders.set("Accept", "text/event-stream");

      const upstreamResponse = await fetch(endpointData.url, {
        method: "POST",
        headers: streamHeaders,
        body: JSON.stringify(payload),
        signal: c.req.raw.signal,
      });

      console.info(
        "[models:stream] Upstream response",
        JSON.stringify({
          org: orgSlug,
          connectionId: connection.id,
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          contentType: upstreamResponse.headers.get("content-type"),
          hasBody: Boolean(upstreamResponse.body),
        }),
      );

      if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
        const text = await upstreamResponse.text();

        console.error(
          "[models:stream] Upstream error",
          JSON.stringify({
            org: orgSlug,
            connectionId: connection.id,
            status: upstreamResponse.status,
            detail: text.slice(0, 500),
          }),
        );

        const status = upstreamResponse.status as ContentfulStatusCode;
        return c.json(
          {
            error: "Streaming request failed",
            detail: text,
          },
          status,
        );
      }

      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set("Cache-Control", "no-cache");
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("Content-Encoding");
      responseHeaders.delete("content-length");
      responseHeaders.delete("Content-Length");
      responseHeaders.delete("transfer-encoding");
      responseHeaders.delete("Transfer-Encoding");

      const upstreamBody = upstreamResponse.body;

      if (!upstreamBody) {
        return new Response(null, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      }

      const proxiedStream = createProxyStream(upstreamBody, {
        org: orgSlug,
        connectionId: connection.id,
      });

      return new Response(proxiedStream, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } finally {
      await client.close?.();
    }
  } catch (error) {
    const err = error as Error;
    if (err.name === "AbortError") {
      console.warn(
        "[models:stream] Aborted",
        JSON.stringify({
          org: orgSlug,
        }),
      );
      return c.json({ error: "Streaming request aborted" }, 400);
    }
    console.error(
      "[models:stream] Failed",
      JSON.stringify({
        org: orgSlug,
        error: err.message,
      }),
    );
    return c.json({ error: err.message }, 400);
  }
});

export default app;
