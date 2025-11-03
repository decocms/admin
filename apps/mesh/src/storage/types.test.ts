import { describe, expect, it } from "vitest";
import type { Database, MCPConnection, Permission } from "./types";

describe("Database Types", () => {
  describe("Permission format", () => {
    it("should allow valid Permission format", () => {
      const permission: Permission = {
        conn_abc123: ["SEND_MESSAGE", "LIST_THREADS"],
        mcp: ["PROJECT_CREATE", "PROJECT_LIST"],
      };
      expect(permission).toBeDefined();
      expect(permission["conn_abc123"]).toEqual([
        "SEND_MESSAGE",
        "LIST_THREADS",
      ]);
      expect(permission["mcp"]).toEqual(["PROJECT_CREATE", "PROJECT_LIST"]);
    });

    it("should allow wildcard permissions", () => {
      const permission: Permission = {
        conn_123: ["*"],
      };
      expect(permission["conn_123"]).toEqual(["*"]);
    });

    it("should allow empty permission object", () => {
      const permission: Permission = {};
      expect(Object.keys(permission)).toHaveLength(0);
    });
  });

  describe("MCPConnection scoping", () => {
    it("should allow organization-scoped connection", () => {
      const conn: Partial<MCPConnection> = {
        id: "conn_123",
        projectId: null, // Organization-scoped
        name: "Test",
        connectionType: "HTTP",
        connectionUrl: "https://example.com",
      };
      expect(conn.projectId).toBeNull();
    });

    it("should allow project-scoped connection", () => {
      const conn: Partial<MCPConnection> = {
        id: "conn_123",
        projectId: "proj_abc", // Project-scoped
        name: "Test",
        connectionType: "HTTP",
        connectionUrl: "https://example.com",
      };
      expect(conn.projectId).toBe("proj_abc");
    });

    it("should support all connection types", () => {
      const httpConn: Pick<MCPConnection, "connectionType"> = {
        connectionType: "HTTP",
      };
      const sseConn: Pick<MCPConnection, "connectionType"> = {
        connectionType: "SSE",
      };
      const wsConn: Pick<MCPConnection, "connectionType"> = {
        connectionType: "Websocket",
      };

      expect(httpConn.connectionType).toBe("HTTP");
      expect(sseConn.connectionType).toBe("SSE");
      expect(wsConn.connectionType).toBe("Websocket");
    });
  });

  describe("Database schema", () => {
    it("should have all required tables", () => {
      // Type-level test - if this compiles, the schema is valid
      const tableNames: (keyof Database)[] = [
        "users",
        "projects",
        "connections",
        "roles",
        "api_keys",
        "audit_logs",
        "oauth_clients",
        "oauth_authorization_codes",
        "oauth_refresh_tokens",
        "downstream_tokens",
      ];

      expect(tableNames).toHaveLength(10);
    });
  });

  describe("Organization model", () => {
    it("should reflect database as organization boundary", () => {
      // Conceptual test - validates our understanding
      const organizationConcept = {
        database: "organization boundary",
        users: "organization members",
        projects: "namespaces (isolate resources, not users)",
        accessControl: "via roles and permissions",
      };

      expect(organizationConcept.database).toBe("organization boundary");
      expect(organizationConcept.projects).toContain("namespaces");
    });
  });
});
