import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDatabase, closeDatabase } from "../../database";
import { createTestSchema } from "../../storage/__test-helpers";
import {
  CONNECTION_CREATE,
  CONNECTION_LIST,
  CONNECTION_GET,
  CONNECTION_DELETE,
  CONNECTION_TEST,
} from "./index";
import type { Kysely } from "kysely";
import type { Database } from "../../storage/types";
import type { MeshContext } from "../../core/mesh-context";
import { ConnectionStorage } from "../../storage/connection";

describe("Connection Tools", () => {
  let db: Kysely<Database>;
  let ctx: MeshContext;

  beforeAll(async () => {
    const tempDbPath = `/tmp/test-connection-tools-${Date.now()}.db`;
    db = createDatabase(`file:${tempDbPath}`);
    await createTestSchema(db);

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
        connections: new ConnectionStorage(db),
        auditLogs: null as any,
      },
      vault: null as any,
      authInstance: null as any,
      access: {
        granted: () => true,
        check: async () => {},
        grant: () => {},
      } as any,
      db,
      tracer: {
        startActiveSpan: (_name: string, _opts: any, fn: any) =>
          fn({
            setStatus: () => {},
            recordException: () => {},
            end: () => {},
          }),
      } as any,
      meter: {
        createHistogram: () => ({ record: () => {} }),
        createCounter: () => ({ add: () => {} }),
      } as any,
      baseUrl: "https://mesh.example.com",
      metadata: {
        requestId: "req_123",
        timestamp: new Date(),
      },
    };
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  describe("CONNECTION_CREATE", () => {
    it("should create organization-scoped connection", async () => {
      const result = await CONNECTION_CREATE.execute(
        {
          name: "Company Slack",
          description: "Organization-wide Slack",
          connection: {
            type: "HTTP",
            url: "https://slack.com/mcp",
            token: "slack-token",
          },
        },
        ctx,
      );

      expect(result.id).toMatch(/^conn_/);
      expect(result.name).toBe("Company Slack");
      expect(result.organizationId).toBe("org_123");
      expect(result.status).toBe("active");
    });

    it("should support different connection types", async () => {
      const httpResult = await CONNECTION_CREATE.execute(
        {
          name: "HTTP Connection",
          connection: { type: "HTTP", url: "https://http.com" },
        },
        ctx,
      );
      expect(httpResult.id).toBeDefined();

      const sseResult = await CONNECTION_CREATE.execute(
        {
          name: "SSE Connection",
          connection: {
            type: "SSE",
            url: "https://sse.com",
            headers: { "X-Custom": "value" },
          },
        },
        ctx,
      );
      expect(sseResult.id).toBeDefined();

      const wsResult = await CONNECTION_CREATE.execute(
        {
          name: "WS Connection",
          connection: { type: "Websocket", url: "wss://ws.com" },
        },
        ctx,
      );
      expect(wsResult.id).toBeDefined();
    });
  });

  describe("CONNECTION_LIST", () => {
    beforeAll(async () => {
      // Create some test connections
      await CONNECTION_CREATE.execute(
        {
          name: "Org Connection 1",
          connection: { type: "HTTP", url: "https://org1.com" },
        },
        ctx,
      );

      await CONNECTION_CREATE.execute(
        {
          name: "Org Connection 2",
          connection: { type: "HTTP", url: "https://org2.com" },
        },
        ctx,
      );
    });

    it("should list all connections in organization", async () => {
      const result = await CONNECTION_LIST.execute({}, ctx);

      expect(result.connections.length).toBeGreaterThan(0);
      expect(
        result.connections.every((c) => c.organizationId === "org_123"),
      ).toBe(true);
    });

    it("should include connection details", async () => {
      const result = await CONNECTION_LIST.execute({}, ctx);

      const conn = result.connections[0];
      expect(conn).toHaveProperty("id");
      expect(conn).toHaveProperty("name");
      expect(conn).toHaveProperty("organizationId");
      expect(conn).toHaveProperty("connectionType");
      expect(conn).toHaveProperty("connectionUrl");
      expect(conn).toHaveProperty("status");
    });
  });

  describe("CONNECTION_GET", () => {
    it("should get connection by ID", async () => {
      const created = await CONNECTION_CREATE.execute(
        {
          name: "Get Test",
          connection: { type: "HTTP", url: "https://test.com" },
        },
        ctx,
      );

      const result = await CONNECTION_GET.execute(
        {
          id: created.id,
        },
        ctx,
      );

      expect(result.id).toBe(created.id);
      expect(result.name).toBe("Get Test");
    });

    it("should throw when connection not found", async () => {
      await expect(
        CONNECTION_GET.execute(
          {
            id: "conn_nonexistent",
          },
          ctx,
        ),
      ).rejects.toThrow("Connection not found");
    });
  });

  describe("CONNECTION_DELETE", () => {
    it("should delete connection", async () => {
      const created = await CONNECTION_CREATE.execute(
        {
          name: "To Delete",
          connection: { type: "HTTP", url: "https://delete.com" },
        },
        ctx,
      );

      const result = await CONNECTION_DELETE.execute(
        {
          id: created.id,
        },
        ctx,
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe(created.id);

      // Verify it's deleted
      await expect(
        CONNECTION_GET.execute(
          {
            id: created.id,
          },
          ctx,
        ),
      ).rejects.toThrow("Connection not found");
    });
  });

  describe("CONNECTION_TEST", () => {
    it("should test connection health", async () => {
      const created = await CONNECTION_CREATE.execute(
        {
          name: "Test Health",
          connection: {
            type: "HTTP",
            url: "https://this-will-fail.invalid",
          },
        },
        ctx,
      );

      const result = await CONNECTION_TEST.execute(
        {
          id: created.id,
        },
        ctx,
      );

      expect(result.id).toBe(created.id);
      expect(result).toHaveProperty("healthy");
      expect(result).toHaveProperty("latencyMs");
      expect(typeof result.latencyMs).toBe("number");
    });

    it("should throw when connection not found", async () => {
      await expect(
        CONNECTION_TEST.execute(
          {
            id: "conn_nonexistent",
          },
          ctx,
        ),
      ).rejects.toThrow("Connection not found");
    });
  });
});
