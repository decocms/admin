import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDatabase, closeDatabase } from "../../database";
import { createTestSchema } from "../../storage/test-helpers";
import { CredentialVault } from "../../encryption/credential-vault";
import {
  COLLECTION_CONNECTIONS_CREATE,
  COLLECTION_CONNECTIONS_LIST,
  COLLECTION_CONNECTIONS_GET,
  COLLECTION_CONNECTIONS_DELETE,
  COLLECTION_CONNECTIONS_TEST,
} from "./index";
import type { Kysely } from "kysely";
import type { Database } from "../../storage/types";
import type { MeshContext } from "../../core/mesh-context";
import { ConnectionStorage } from "../../storage/connection";

describe("Connection Tools", () => {
  let db: Kysely<Database>;
  let ctx: MeshContext;
  let matchingConnectionId: string;

  beforeAll(async () => {
    const tempDbPath = `/tmp/test-connection-tools-${Date.now()}.db`;
    db = createDatabase(`file:${tempDbPath}`);
    await createTestSchema(db);

    const vault = new CredentialVault(CredentialVault.generateKey());

    // Create mock context
    ctx = {
      auth: {
        user: {
          id: "user_1",
          email: "[email protected]",
          name: "Test",
          role: "admin",
        },
      },
      organization: {
        id: "org_123",
        slug: "test-org",
        name: "Test Organization",
      },
      storage: {
        connections: new ConnectionStorage(db, vault),
        auditLogs: null as never,
        organizationSettings: {
          get: async () => null,
          upsert: async (
            _orgId: string,
            data: { modelsBindingConnectionId?: string },
          ) => ({
            organizationId: _orgId,
            modelsBindingConnectionId: data.modelsBindingConnectionId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        } as never,
      },
      vault: null as never,
      authInstance: null as never,
      access: {
        granted: () => true,
        check: async () => {},
        grant: () => {},
        setToolName: () => {},
      } as never,
      db,
      tracer: {
        startActiveSpan: (
          _name: string,
          _opts: unknown,
          fn: (span: unknown) => unknown,
        ) =>
          fn({
            setStatus: () => {},
            recordException: () => {},
            end: () => {},
          }),
      } as never,
      meter: {
        createHistogram: () => ({ record: () => {} }),
        createCounter: () => ({ add: () => {} }),
      } as never,
      baseUrl: "https://mesh.example.com",
      metadata: {
        requestId: "req_123",
        timestamp: new Date(),
      },
    };

    const connectionWithModels = await COLLECTION_CONNECTIONS_CREATE.execute(
      {
        data: {
          title: "Org Connection 1",
          connection_type: "HTTP",
          connection_url: "https://org1.com",
        },
      },
      ctx,
    );
    matchingConnectionId = connectionWithModels.item.id;

    await ctx.storage.connections.update(matchingConnectionId, {
      tools: [
        {
          name: "MODELS_LIST",
          inputSchema: {},
          outputSchema: { models: [] },
        },
        {
          name: "GET_STREAM_ENDPOINT",
          inputSchema: {},
          outputSchema: { url: "https://example.com/stream" },
        },
      ],
    });

    await COLLECTION_CONNECTIONS_CREATE.execute(
      {
        data: {
          title: "Org Connection 2",
          connection_type: "HTTP",
          connection_url: "https://org2.com",
        },
      },
      ctx,
    );
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  describe("COLLECTION_CONNECTIONS_CREATE", () => {
    it("should create organization-scoped connection", async () => {
      const result = await COLLECTION_CONNECTIONS_CREATE.execute(
        {
          data: {
            title: "Company Slack",
            description: "Organization-wide Slack",
            connection_type: "HTTP",
            connection_url: "https://slack.com/mcp",
            connection_token: "slack-token",
          },
        },
        ctx,
      );

      expect(result.item.id).toMatch(/^conn_/);
      expect(result.item.title).toBe("Company Slack");
      expect(result.item.organization_id).toBe("org_123");
      expect(result.item.status).toBe("active");
    });

    it("should support different connection types", async () => {
      const httpResult = await COLLECTION_CONNECTIONS_CREATE.execute(
        {
          data: {
            title: "HTTP Connection",
            connection_type: "HTTP",
            connection_url: "https://http.com",
          },
        },
        ctx,
      );
      expect(httpResult.item.id).toBeDefined();

      const sseResult = await COLLECTION_CONNECTIONS_CREATE.execute(
        {
          data: {
            title: "SSE Connection",
            connection_type: "SSE",
            connection_url: "https://sse.com",
            connection_headers: { "X-Custom": "value" },
          },
        },
        ctx,
      );
      expect(sseResult.item.id).toBeDefined();

      const wsResult = await COLLECTION_CONNECTIONS_CREATE.execute(
        {
          data: {
            title: "WS Connection",
            connection_type: "Websocket",
            connection_url: "wss://ws.com",
          },
        },
        ctx,
      );
      expect(wsResult.item.id).toBeDefined();
    });
  });

  describe("COLLECTION_CONNECTIONS_LIST", () => {
    it("should list all connections in organization", async () => {
      const result = await COLLECTION_CONNECTIONS_LIST.execute({}, ctx);

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.every((c) => c.organization_id === "org_123")).toBe(
        true,
      );
    });

    it("should include connection details", async () => {
      const result = await COLLECTION_CONNECTIONS_LIST.execute({}, ctx);

      const conn = result.items[0];
      expect(conn).toHaveProperty("id");
      expect(conn).toHaveProperty("title");
      expect(conn).toHaveProperty("organization_id");
      expect(conn).toHaveProperty("connection_type");
      expect(conn).toHaveProperty("connection_url");
      expect(conn).toHaveProperty("status");
    });

    it("should filter connections by binding schema", async () => {
      const result = await COLLECTION_CONNECTIONS_LIST.execute(
        { binding: "MODELS" },
        ctx,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(matchingConnectionId);
    });
  });

  describe("COLLECTION_CONNECTIONS_GET", () => {
    it("should get connection by ID", async () => {
      const created = await COLLECTION_CONNECTIONS_CREATE.execute(
        {
          data: {
            title: "Get Test",
            connection_type: "HTTP",
            connection_url: "https://test.com",
          },
        },
        ctx,
      );

      const result = await COLLECTION_CONNECTIONS_GET.execute(
        {
          id: created.item.id,
        },
        ctx,
      );

      expect(result.item?.id).toBe(created.item.id);
      expect(result.item?.title).toBe("Get Test");
    });

    it("should return null when connection not found", async () => {
      const result = await COLLECTION_CONNECTIONS_GET.execute(
        {
          id: "conn_nonexistent",
        },
        ctx,
      );

      expect(result.item).toBeNull();
    });
  });

  describe("COLLECTION_CONNECTIONS_DELETE", () => {
    it("should delete connection", async () => {
      const created = await COLLECTION_CONNECTIONS_CREATE.execute(
        {
          data: {
            title: "To Delete",
            connection_type: "HTTP",
            connection_url: "https://delete.com",
          },
        },
        ctx,
      );

      const result = await COLLECTION_CONNECTIONS_DELETE.execute(
        {
          id: created.item.id,
        },
        ctx,
      );

      expect(result.item.id).toBe(created.item.id);

      // Verify it's deleted
      const getResult = await COLLECTION_CONNECTIONS_GET.execute(
        {
          id: created.item.id,
        },
        ctx,
      );
      expect(getResult.item).toBeNull();
    });
  });

  describe("COLLECTION_CONNECTIONS_TEST", () => {
    it("should test connection health", async () => {
      const created = await COLLECTION_CONNECTIONS_CREATE.execute(
        {
          data: {
            title: "Test Health",
            connection_type: "HTTP",
            connection_url: "https://this-will-fail.invalid",
          },
        },
        ctx,
      );

      const result = await COLLECTION_CONNECTIONS_TEST.execute(
        {
          id: created.item.id,
        },
        ctx,
      );

      expect(result.id).toBe(created.item.id);
      expect(result).toHaveProperty("healthy");
      expect(result).toHaveProperty("latencyMs");
      expect(typeof result.latencyMs).toBe("number");
    });

    it("should throw when connection not found", async () => {
      await expect(
        COLLECTION_CONNECTIONS_TEST.execute(
          {
            id: "conn_nonexistent",
          },
          ctx,
        ),
      ).rejects.toThrow("Connection not found");
    });
  });
});
