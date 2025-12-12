/* oxlint-disable no-explicit-any */
import type { Kysely } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "bun:test";
import type { Meter, Tracer } from "@opentelemetry/api";
import { closeDatabase, createDatabase } from "../database";
import { createTestSchema } from "../storage/test-helpers";
import type { Database } from "../storage/types";
import { createMeshContextFactory } from "./context-factory";
import type { BetterAuthInstance } from "./mesh-context";

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

  // Helper to create a mock Request object (factory expects Request, not Hono context)
  const createMockRequest = (options?: {
    url?: string;
    headers?: Record<string, string>;
  }): Request => {
    const url = options?.url ?? "https://mesh.example.com/mcp/tools";
    const headers = new Headers(
      options?.headers ?? {
        Authorization: "Bearer test_key",
      },
    );
    return new Request(url, { headers });
  };

  const createMockAuth = (): any => ({
    api: {
      getMcpSession: vi.fn().mockResolvedValue(null) as any,
      verifyApiKey: vi.fn().mockResolvedValue({
        valid: true,
        key: {
          id: "key_1",
          name: "Test Key",
          userId: "user_1",
          permissions: { self: ["COLLECTION_CONNECTIONS_LIST"] },
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
        auth: createMockAuth() as unknown as BetterAuthInstance,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as unknown as Tracer,
          meter: {} as unknown as Meter,
        },
      });

      expect(typeof factory).toBe("function");
    });
  });

  // Create mock auth with minimal API for unauthenticated requests
  const createMinimalMockAuth = (): any => ({
    api: {
      getMcpSession: vi.fn().mockResolvedValue(null),
      verifyApiKey: vi.fn().mockResolvedValue({ valid: false }),
      getSession: vi.fn().mockResolvedValue(null),
    },
  });

  describe("MeshContext creation", () => {
    it("should create MeshContext from Request", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: createMinimalMockAuth() as unknown as BetterAuthInstance,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as unknown as Tracer,
          meter: {} as unknown as Meter,
        },
      });

      const request = createMockRequest({
        url: "https://mesh.example.com/mcp/tools",
        headers: {}, // No Authorization
      });

      const meshCtx = await factory(request);

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
        auth: createMinimalMockAuth() as unknown as BetterAuthInstance,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as unknown as Tracer,
          meter: {} as unknown as Meter,
        },
      });

      const request = createMockRequest({
        url: "http://localhost:3000/mcp/tools",
        headers: {},
      });

      const meshCtx = await factory(request);

      expect(meshCtx.baseUrl).toBe("http://localhost:3000");
    });

    it("should populate request metadata", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: createMinimalMockAuth() as unknown as BetterAuthInstance,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as unknown as Tracer,
          meter: {} as unknown as Meter,
        },
      });

      const request = createMockRequest({
        url: "https://mesh.example.com/mcp/tools",
        headers: {
          "User-Agent": "Test/1.0",
          "X-Forwarded-For": "192.168.1.1",
        },
      });

      const meshCtx = await factory(request);

      expect(meshCtx.metadata.userAgent).toBe("Test/1.0");
      expect(meshCtx.metadata.ipAddress).toBe("192.168.1.1");
      expect(meshCtx.metadata.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("organization scope", () => {
    it("should extract organization from Better Auth", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: createMockAuth() as unknown as BetterAuthInstance,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as unknown as Tracer,
          meter: {} as unknown as Meter,
        },
      });

      const request = createMockRequest();

      const meshCtx = await factory(request);

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
              permissions: { self: ["COLLECTION_CONNECTIONS_LIST"] },
              metadata: {},
            },
          }),
        },
      };

      const factory = createMeshContextFactory({
        db,
        auth: authWithoutOrg as unknown as BetterAuthInstance,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as unknown as Tracer,
          meter: {} as unknown as Meter,
        },
      });

      const request = createMockRequest();
      const meshCtx = await factory(request);

      expect(meshCtx.organization).toBeUndefined();
    });
  });

  describe("storage initialization", () => {
    it("should create storage adapters", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: createMinimalMockAuth() as unknown as BetterAuthInstance,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as unknown as Tracer,
          meter: {} as unknown as Meter,
        },
      });

      const request = createMockRequest({
        url: "https://mesh.example.com/mcp/tools",
        headers: {},
      });

      const meshCtx = await factory(request);

      expect(meshCtx.storage.connections).toBeDefined();
      expect(meshCtx.storage.auditLogs).toBeDefined();
      expect(meshCtx.storage.organizationSettings).toBeDefined();
    });
  });

  describe("access control initialization", () => {
    it("should create AccessControl instance", async () => {
      const factory = createMeshContextFactory({
        db,
        auth: createMinimalMockAuth() as unknown as BetterAuthInstance,
        encryption: { key: "test_key" },
        observability: {
          tracer: {} as unknown as Tracer,
          meter: {} as unknown as Meter,
        },
      });

      const request = createMockRequest({
        url: "https://mesh.example.com/mcp/tools",
        headers: {},
      });

      const meshCtx = await factory(request);

      expect(meshCtx.access).toBeDefined();
      expect(meshCtx.access.granted).toBeDefined();
      expect(meshCtx.access.check).toBeDefined();
      expect(meshCtx.access.grant).toBeDefined();
    });
  });
});
