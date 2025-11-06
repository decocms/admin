import { describe, it, expect } from "vitest";
import {
  processFileContent,
  convertJsonToCode,
  prepareFileForZip,
  exportAgent,
  processDatabaseSchema,
  exportDatabaseTable,
  stripSrcPrefix,
  buildManifest,
} from "../src/mcp/teams/export-project.ts";

describe("export-project", () => {
  describe("processFileContent", () => {
    it("should handle string content", () => {
      const result = processFileContent({
        filePath: "test.txt",
        readResponse: { content: "Hello, world!" },
      });

      expect(result.contentStr).toBe("Hello, world!");
    });

    it("should handle base64 encoded string content", () => {
      const base64Content = Buffer.from("Hello, world!", "utf-8").toString(
        "base64",
      );
      const result = processFileContent({
        filePath: "test.txt",
        readResponse: { content: base64Content },
      });

      expect(result.contentStr).toBe("Hello, world!");
    });

    it("should handle base64 object content", () => {
      const base64Content = Buffer.from("Hello, world!", "utf-8").toString(
        "base64",
      );
      const result = processFileContent({
        filePath: "test.txt",
        readResponse: { content: { base64: base64Content } },
      });

      expect(result.contentStr).toBe("Hello, world!");
    });

    it("should handle missing content", () => {
      const result = processFileContent({
        filePath: "test.txt",
        readResponse: {},
      });

      expect(result.contentStr).toBe("");
    });

    it("should stringify non-string content", () => {
      const result = processFileContent({
        filePath: "test.json",
        readResponse: { content: { key: "value" } },
      });

      expect(result.contentStr).toBe('{"key":"value"}');
    });

    it("should handle invalid base64 gracefully", () => {
      const result = processFileContent({
        filePath: "test.txt",
        readResponse: { content: "not-base64-but-matches-regex!!!" },
      });

      // Should fall back to using as-is
      expect(result.contentStr).toBe("not-base64-but-matches-regex!!!");
    });
  });

  describe("convertJsonToCode", () => {
    it("should convert view JSON to code", () => {
      const jsonContent = JSON.stringify({
        name: "TestView",
        icon: "🔧",
        title: "Test View",
        description: "A test view",
        component: `export default function TestView() { return <div>Test</div>; }`,
      });

      const result = convertJsonToCode({
        filePath: "/src/views/test.json",
        contentStr: jsonContent,
      });

      expect(result.converted).toBe(true);
      expect(result.finalPath).toBe("/src/views/test.tsx");
      expect(result.finalContent).toContain("TestView");
    });

    it("should convert tool JSON to code", () => {
      const jsonContent = JSON.stringify({
        name: "TEST_TOOL",
        description: "A test tool",
        execute: `export default async function(input, ctx) { return { success: true }; }`,
      });

      const result = convertJsonToCode({
        filePath: "/src/tools/test.json",
        contentStr: jsonContent,
      });

      expect(result.converted).toBe(true);
      expect(result.finalPath).toBe("/src/tools/test.ts");
      expect(result.finalContent).toContain("TEST_TOOL");
    });

    it("should convert workflow JSON to code", () => {
      const jsonContent = JSON.stringify({
        name: "TestWorkflow",
        description: "A test workflow",
        steps: [],
        execute: `export default async function(input, ctx) { return { success: true }; }`,
      });

      const result = convertJsonToCode({
        filePath: "/src/workflows/test.json",
        contentStr: jsonContent,
      });

      expect(result.converted).toBe(true);
      expect(result.finalPath).toBe("/src/workflows/test.ts");
      expect(result.finalContent).toContain("TestWorkflow");
    });

    it("should keep document JSON as-is", () => {
      const jsonContent = JSON.stringify({ data: "test" });

      const result = convertJsonToCode({
        filePath: "/src/documents/test.json",
        contentStr: jsonContent,
      });

      expect(result.converted).toBe(false);
      expect(result.finalPath).toBe("/src/documents/test.json");
      expect(result.finalContent).toBe(jsonContent);
    });

    it("should not convert non-JSON files", () => {
      const content = "Some text content";

      const result = convertJsonToCode({
        filePath: "/src/documents/test.txt",
        contentStr: content,
      });

      expect(result.converted).toBe(false);
      expect(result.finalPath).toBe("/src/documents/test.txt");
      expect(result.finalContent).toBe(content);
    });

    it("should handle malformed JSON gracefully", () => {
      const result = convertJsonToCode({
        filePath: "/src/tools/test.json",
        contentStr: "invalid json{",
      });

      expect(result.converted).toBe(false);
      expect(result.finalContent).toBe("invalid json{");
    });
  });

  describe("prepareFileForZip", () => {
    it("should prepare a valid file and convert tool JSON to code", () => {
      const jsonContent = JSON.stringify({
        name: "TEST_TOOL",
        description: "A test tool",
        execute: `export default async function(input, ctx) { return { success: true }; }`,
      });

      const result = prepareFileForZip({
        filePath: "/src/tools/test.json",
        contentStr: jsonContent,
      });

      expect(result.shouldInclude).toBe(true);
      // Tool JSON should be converted to .ts
      expect(result.relativePath).toBe("tools/test.ts");
    });

    it("should keep document JSON as-is", () => {
      const result = prepareFileForZip({
        filePath: "/src/documents/data.json",
        contentStr: '{"data": "some document data"}',
      });

      expect(result.shouldInclude).toBe(true);
      expect(result.relativePath).toBe("documents/data.json");
    });

    it("should handle files without /src/ prefix", () => {
      const result = prepareFileForZip({
        filePath: "documents/readme.txt",
        contentStr: "Some content",
      });

      expect(result.shouldInclude).toBe(true);
      expect(result.relativePath).toBe("documents/readme.txt");
    });

    it("should convert code extension when converting to code", () => {
      const jsonContent = JSON.stringify({
        name: "TEST_TOOL",
        execute: `export default async function() {}`,
      });

      const result = prepareFileForZip({
        filePath: "/src/tools/test.json",
        contentStr: jsonContent,
      });

      expect(result.shouldInclude).toBe(true);
      expect(result.relativePath).toBe("tools/test.ts");
    });
  });

  describe("exportAgent", () => {
    it("should export a complete agent", () => {
      const agent = {
        name: "Test Agent",
        avatar: "https://example.com/avatar.png",
        instructions: "You are helpful",
        description: "A test agent",
        tools_set: { enabled: ["tool1"] },
        max_steps: 10,
        max_tokens: 1000,
        model: "gpt-4",
        memory: { type: "short-term" },
        views: ["view1"],
        visibility: "PUBLIC" as const,
        temperature: 0.7,
      };

      const result = exportAgent({ agent });

      expect(result.filename).toBe("test-agent.json");
      expect(result.content).toContain('"name": "Test Agent"');
      expect(result.content).toContain('"visibility": "PUBLIC"');
      expect(JSON.parse(result.content)).toEqual(agent);
    });

    it("should handle agents with special characters in name", () => {
      const agent = {
        name: "Test Agent (v2)!",
        avatar: null,
        instructions: null,
        description: null,
        tools_set: null,
        max_steps: null,
        max_tokens: null,
        model: null,
        memory: null,
        views: null,
        visibility: "PRIVATE" as const,
        temperature: null,
      };

      const result = exportAgent({ agent });

      expect(result.filename).toBe("test-agent-v2.json");
      expect(result.filename).not.toContain("(");
      expect(result.filename).not.toContain(")");
      expect(result.filename).not.toContain("!");
    });

    it("should handle agents with null values", () => {
      const agent = {
        name: "Minimal Agent",
        avatar: null,
        instructions: null,
        description: null,
        tools_set: null,
        max_steps: null,
        max_tokens: null,
        model: null,
        memory: null,
        views: null,
        visibility: null,
        temperature: null,
      };

      const result = exportAgent({ agent });

      expect(result.filename).toBe("minimal-agent.json");
      const parsed = JSON.parse(result.content);
      expect(parsed.avatar).toBeNull();
      expect(parsed.visibility).toBeNull();
    });
  });

  describe("processDatabaseSchema", () => {
    it("should process a valid database schema", () => {
      const schemaResponse = {
        result: [
          {
            results: [
              {
                type: "table",
                name: "users",
                tbl_name: "users",
                sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
              },
              {
                type: "index",
                name: "idx_users_id",
                tbl_name: "users",
                sql: "CREATE INDEX idx_users_id ON users(id)",
              },
            ],
          },
        ],
      };

      const result = processDatabaseSchema({ schemaResponse });

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].tableName).toBe("users");
      expect(result.tables[0].createSql).toContain("CREATE TABLE");
      expect(result.tables[0].indexes).toHaveLength(1);
      expect(result.tables[0].indexes[0].name).toBe("idx_users_id");
    });

    it("should filter out sqlite system tables", () => {
      const schemaResponse = {
        result: [
          {
            results: [
              {
                type: "table",
                name: "sqlite_sequence",
                tbl_name: "sqlite_sequence",
                sql: "CREATE TABLE sqlite_sequence(name,seq)",
              },
              {
                type: "table",
                name: "users",
                tbl_name: "users",
                sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
              },
            ],
          },
        ],
      };

      const result = processDatabaseSchema({ schemaResponse });

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].tableName).toBe("users");
    });

    it("should filter out mastra system tables", () => {
      const schemaResponse = {
        result: [
          {
            results: [
              {
                type: "table",
                name: "mastra_workflows",
                tbl_name: "mastra_workflows",
                sql: "CREATE TABLE mastra_workflows (id TEXT PRIMARY KEY)",
              },
              {
                type: "table",
                name: "users",
                tbl_name: "users",
                sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
              },
            ],
          },
        ],
      };

      const result = processDatabaseSchema({ schemaResponse });

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].tableName).toBe("users");
    });

    it("should handle empty results", () => {
      const schemaResponse = {
        result: [],
      };

      const result = processDatabaseSchema({ schemaResponse });

      expect(result.tables).toHaveLength(0);
    });

    it("should handle tables without indexes", () => {
      const schemaResponse = {
        result: [
          {
            results: [
              {
                type: "table",
                name: "users",
                tbl_name: "users",
                sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
              },
            ],
          },
        ],
      };

      const result = processDatabaseSchema({ schemaResponse });

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].indexes).toEqual([]);
    });

    it("should group indexes by table", () => {
      const schemaResponse = {
        result: [
          {
            results: [
              {
                type: "table",
                name: "users",
                tbl_name: "users",
                sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)",
              },
              {
                type: "index",
                name: "idx_users_id",
                tbl_name: "users",
                sql: "CREATE INDEX idx_users_id ON users(id)",
              },
              {
                type: "index",
                name: "idx_users_email",
                tbl_name: "users",
                sql: "CREATE INDEX idx_users_email ON users(email)",
              },
            ],
          },
        ],
      };

      const result = processDatabaseSchema({ schemaResponse });

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].indexes).toHaveLength(2);
    });

    it("should filter out non-table types", () => {
      const schemaResponse = {
        result: [
          {
            results: [
              {
                type: "view",
                name: "user_view",
                tbl_name: "user_view",
                sql: "CREATE VIEW user_view AS SELECT * FROM users",
              },
              {
                type: "table",
                name: "users",
                tbl_name: "users",
                sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
              },
            ],
          },
        ],
      };

      const result = processDatabaseSchema({ schemaResponse });

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].tableName).toBe("users");
    });
  });

  describe("exportDatabaseTable", () => {
    it("should export a table with indexes", () => {
      const table = {
        tableName: "users",
        createSql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
        indexes: [
          {
            name: "idx_users_id",
            sql: "CREATE INDEX idx_users_id ON users(id)",
          },
        ],
      };

      const result = exportDatabaseTable({ table });

      expect(result.filename).toBe("users.json");
      expect(result.content).toContain('"name": "users"');

      const parsed = JSON.parse(result.content);
      expect(parsed.name).toBe("users");
      expect(parsed.createSql).toBe(table.createSql);
      expect(parsed.indexes).toHaveLength(1);
    });

    it("should sanitize table names for filenames", () => {
      const table = {
        tableName: "user_accounts@v2",
        createSql: "CREATE TABLE user_accounts@v2 (id INTEGER PRIMARY KEY)",
        indexes: [],
      };

      const result = exportDatabaseTable({ table });

      expect(result.filename).toBe("user_accounts-v2.json");
      expect(result.filename).not.toContain("@");
    });

    it("should handle tables without indexes", () => {
      const table = {
        tableName: "users",
        createSql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
        indexes: [],
      };

      const result = exportDatabaseTable({ table });

      const parsed = JSON.parse(result.content);
      expect(parsed.indexes).toEqual([]);
    });
  });

  describe("stripSrcPrefix", () => {
    it("should strip /src/ prefix from paths", () => {
      const result = stripSrcPrefix({
        paths: ["/src/tools/test.ts", "/src/views/test.tsx"],
      });

      expect(result).toEqual(["/tools/test.ts", "/views/test.tsx"]);
    });

    it("should handle paths without /src/ prefix", () => {
      const result = stripSrcPrefix({
        paths: ["/tools/test.ts", "/views/test.tsx"],
      });

      expect(result).toEqual(["/tools/test.ts", "/views/test.tsx"]);
    });

    it("should handle empty array", () => {
      const result = stripSrcPrefix({ paths: [] });

      expect(result).toEqual([]);
    });

    it("should handle mixed paths", () => {
      const result = stripSrcPrefix({
        paths: ["/src/tools/test.ts", "/views/test.tsx", "documents/test.md"],
      });

      expect(result).toEqual([
        "/tools/test.ts",
        "/views/test.tsx",
        "documents/test.md",
      ]);
    });
  });

  describe("buildManifest", () => {
    it("should build a complete manifest", () => {
      const manifest = buildManifest({
        projectInfo: {
          slug: "test-project",
          title: "Test Project",
          description: "A test project",
        },
        exporterInfo: {
          orgSlug: "test-org",
          userId: "user123",
          userEmail: "user@example.com",
        },
        resources: {
          tools: ["/src/tools/test.ts"],
          views: ["/src/views/test.tsx"],
          workflows: ["/src/workflows/test.ts"],
          documents: ["/src/documents/test.md"],
          database: ["/database/users.json"],
        },
        dependencies: {
          mcps: ["mcp1", "mcp2"],
        },
      });

      expect(manifest.project.slug).toBe("test-project");
      expect(manifest.project.title).toBe("Test Project");
      expect(manifest.project.description).toBe("A test project");
      expect(manifest.resources.tools).toEqual(["/tools/test.ts"]);
      expect(manifest.resources.views).toEqual(["/views/test.tsx"]);
      expect(manifest.dependencies.mcps).toEqual(["mcp1", "mcp2"]);
    });

    it("should handle optional description", () => {
      const manifest = buildManifest({
        projectInfo: {
          slug: "test-project",
          title: "Test Project",
        },
        exporterInfo: {
          orgSlug: "test-org",
          userId: "user123",
        },
        resources: {
          tools: [],
          views: [],
          workflows: [],
          documents: [],
          database: [],
        },
        dependencies: {
          mcps: [],
        },
      });

      expect(manifest.project.slug).toBe("test-project");
      expect(manifest.project.description).toBeUndefined();
    });

    it("should strip /src/ prefix from resource paths", () => {
      const manifest = buildManifest({
        projectInfo: {
          slug: "test-project",
          title: "Test Project",
        },
        exporterInfo: {
          orgSlug: "test-org",
          userId: "user123",
        },
        resources: {
          tools: ["/src/tools/test1.ts", "/src/tools/test2.ts"],
          views: ["/src/views/test1.tsx"],
          workflows: [],
          documents: [],
          database: [],
        },
        dependencies: {
          mcps: [],
        },
      });

      expect(manifest.resources.tools).toEqual([
        "/tools/test1.ts",
        "/tools/test2.ts",
      ]);
      expect(manifest.resources.views).toEqual(["/views/test1.tsx"]);
    });

    it("should handle empty resources", () => {
      const manifest = buildManifest({
        projectInfo: {
          slug: "empty-project",
          title: "Empty Project",
        },
        exporterInfo: {
          orgSlug: "test-org",
          userId: "user123",
        },
        resources: {
          tools: [],
          views: [],
          workflows: [],
          documents: [],
          database: [],
        },
        dependencies: {
          mcps: [],
        },
      });

      expect(manifest.resources.tools).toEqual([]);
      expect(manifest.resources.views).toEqual([]);
      expect(manifest.dependencies.mcps).toEqual([]);
    });
  });
});
