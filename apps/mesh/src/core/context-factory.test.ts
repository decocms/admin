import type { Kysely } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDatabase, createDatabase } from "../database";
import { createTestSchema } from "../storage/test-helpers";
import type { Database } from "../storage/types";
import { createMeshContextFactory } from "./context-factory";
import type { MockAuth, MockTracer, MockMeter } from "../test-utils";

describe("createMeshContextFactory", () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    const tempDbPath = `/tmp/test-context-factory-${Date.now()}.db`;
    db = createDatabase(`file:${tempDbPath}`);
    await createTestSchema(db);
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  const createMockHonoContext = (
    overrides?: Partial<ReturnType<typeof createMockHonoContext>>,
  ) => ({
    req: {
      url: "https://mesh.example.com/mcp/tools",
      path: "/mcp/tools",
      header: vi.fn((name: string) => {
        if (name === "Authorization") return "Bearer test_key";
        if (name === "User-Agent") return "Test/1.0";
        if (name === "X-Forwarded-For") return "192.168.1.1";
        return undefined;
      }),
      raw: {
        headers: new Headers({
          Authorization: "Bearer test_key",
        }),
      },
      ...overrides?.req,
    },
    ...overrides,
  });

  const createMockAuth = (): MockAuth => ({
    api: {
      getMcpSession: vi.fn().mockResolvedValue(null),
      verifyApiKey: vi.fn().mockResolvedValue({
        valid: true,
        key: {
          id: "key_1",
          name: "Test Key",
          userId: "user_1",
          permissions: { self: ["CONNECTION_LIST"] },
          metadata: {
            organization: {
              id: "org_123",
              slug: "test-org",
              name: "Test Organization",
            },
          },
        },
      }),
    },
  });

  describe("factory creation", () => {
    it("should create context factory function", () => {
      const factory = createMeshContextFactory({
        db,
        auth: createMockAuth(),
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as MockTracer,
          meter: {} as MockMeter,
        },
      });

      expect(typeof factory).toBe("function");
    });
  });

  describe("MeshContext creation", () => {
    it("should create MeshContext from Hono context", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null, // No auth for this test
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as MockTracer,
          meter: {} as MockMeter,
        },
      });

      const honoCtx = createMockHonoContext({
        req: {
          url: "https://mesh.example.com/mcp/tools",
          path: "/mcp/tools",
          header: vi.fn(() => undefined), // No Authorization
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx).toBeDefined();
      expect(meshCtx.auth).toBeDefined();
      expect(meshCtx.storage).toBeDefined();
      expect(meshCtx.access).toBeDefined();
      expect(meshCtx.baseUrl).toBe("https://mesh.example.com");
      expect(meshCtx.metadata.requestId).toBeDefined();
    });

    it("should derive base URL from request", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as MockTracer,
          meter: {} as MockMeter,
        },
      });

      const honoCtx = createMockHonoContext({
        req: {
          url: "http://localhost:3000/mcp/tools",
          path: "/mcp/tools",
          header: vi.fn(() => undefined),
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.baseUrl).toBe("http://localhost:3000");
    });

    it("should populate request metadata", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as MockTracer,
          meter: {} as MockMeter,
        },
      });

      const honoCtx = createMockHonoContext({
        req: {
          url: "https://mesh.example.com/mcp/tools",
          path: "/mcp/tools", // Organization-scoped
          header: vi.fn((name: string) => {
            if (name === "User-Agent") return "Test/1.0";
            if (name === "X-Forwarded-For") return "192.168.1.1";
            return undefined;
          }),
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.metadata.userAgent).toBe("Test/1.0");
      expect(meshCtx.metadata.ipAddress).toBe("192.168.1.1");
      expect(meshCtx.metadata.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("organization scope", () => {
    it("should extract organization from Better Auth", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: createMockAuth(),
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as MockTracer,
          meter: {} as MockMeter,
        },
      });

      const honoCtx = createMockHonoContext();

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.organization).toBeDefined();
      expect(meshCtx.organization?.id).toBe("org_123");
      expect(meshCtx.organization?.slug).toBe("test-org");
      expect(meshCtx.organization?.name).toBe("Test Organization");
    });

    it("should work without organization (system-level)", async () => {
      const authWithoutOrg = {
        api: {
          getMcpSession: vi.fn().mockResolvedValue(null),
          verifyApiKey: vi.fn().mockResolvedValue({
            valid: true,
            key: {
              id: "key_1",
              permissions: { self: ["CONNECTION_LIST"] },
              metadata: {},
            },
          }),
        },
      };

      const factory = createMeshContextFactory({
        db,
        auth: authWithoutOrg,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as MockTracer,
          meter: {} as MockMeter,
        },
      });

      const honoCtx = createMockHonoContext();
      const meshCtx = await factory(honoCtx);

      expect(meshCtx.organization).toBeUndefined();
    });
  });

  describe("storage initialization", () => {
    it("should create storage adapters", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as MockTracer,
          meter: {} as MockMeter,
        },
      });

      const honoCtx = createMockHonoContext({
        req: {
          url: "https://mesh.example.com/mcp/tools",
          path: "/mcp/tools",
          header: vi.fn(() => undefined),
          raw: { headers: new Headers() },
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.storage.connections).toBeDefined();
      expect(meshCtx.storage.auditLogs).toBeDefined();
    });
  });

  describe("access control initialization", () => {
    it("should create AccessControl instance", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: null,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as MockTracer,
          meter: {} as MockMeter,
        },
      });

      const honoCtx = createMockHonoContext({
        req: {
          url: "https://mesh.example.com/mcp/tools",
          path: "/mcp/tools",
          header: vi.fn(() => undefined),
        },
      });

      const meshCtx = await factory(honoCtx);

      expect(meshCtx.access).toBeDefined();
      expect(meshCtx.access.granted).toBeDefined();
      expect(meshCtx.access.check).toBeDefined();
      expect(meshCtx.access.grant).toBeDefined();
    });
  });
});
