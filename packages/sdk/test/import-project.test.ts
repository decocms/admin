import { describe, it, expect } from "vitest";
import {
  parseGithubUrl,
  parseManifestFromFiles,
  convertCodeFileToJson,
  prepareFileForUpload,
  parseDatabaseSchema,
  parseAgentFile,
} from "../src/mcp/teams/import-project.ts";
import { UserInputError } from "../src/errors.ts";

describe("import-project", () => {
  describe("parseGithubUrl", () => {
    it("should parse a basic GitHub URL", () => {
      const result = parseGithubUrl({
        githubUrl: "https://github.com/owner/repo",
      });

      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        ref: undefined,
      });
    });

    it("should parse a GitHub URL with .git extension", () => {
      const result = parseGithubUrl({
        githubUrl: "https://github.com/owner/repo.git",
      });

      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        ref: undefined,
      });
    });

    it("should parse a GitHub URL with branch reference", () => {
      const result = parseGithubUrl({
        githubUrl: "https://github.com/owner/repo/tree/feature-branch",
      });

      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        ref: "feature-branch",
      });
    });

    it("should throw error for invalid URL", () => {
      expect(() =>
        parseGithubUrl({ githubUrl: "https://invalid.com/repo" }),
      ).toThrow(UserInputError);
    });

    it("should throw error for missing owner/repo", () => {
      expect(() =>
        parseGithubUrl({ githubUrl: "https://github.com/" }),
      ).toThrow(UserInputError);
    });
  });

  describe("parseManifestFromFiles", () => {
    it("should parse a valid manifest file", () => {
      const manifestContent = JSON.stringify({
        schemaVersion: "1.0",
        project: {
          slug: "test-project",
          title: "Test Project",
          description: "A test project",
        },
        author: {
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
        createdAt: new Date().toISOString(),
      });

      const files = new Map<string, Uint8Array>();
      files.set("deco.mcp.json", new TextEncoder().encode(manifestContent));

      const result = parseManifestFromFiles({ files });

      expect(result.projectSlug).toBe("test-project");
      expect(result.projectTitle).toBe("Test Project");
      expect(result.manifest.project.slug).toBe("test-project");
    });

    it("should use override slug and title", () => {
      const manifestContent = JSON.stringify({
        schemaVersion: "1.0",
        project: {
          slug: "original-slug",
          title: "Original Title",
        },
        author: {
          orgSlug: "test-org",
        },
        resources: {
          tools: [],
          views: [],
          workflows: [],
          documents: [],
        },
        dependencies: {
          mcps: [],
        },
        createdAt: new Date().toISOString(),
      });

      const files = new Map<string, Uint8Array>();
      files.set("deco.mcp.json", new TextEncoder().encode(manifestContent));

      const result = parseManifestFromFiles({
        files,
        overrideSlug: "new-slug",
        overrideTitle: "New Title",
      });

      expect(result.projectSlug).toBe("new-slug");
      expect(result.projectTitle).toBe("New Title");
    });

    it("should throw error when manifest is missing", () => {
      const files = new Map<string, Uint8Array>();

      expect(() => parseManifestFromFiles({ files })).toThrow(UserInputError);
      expect(() => parseManifestFromFiles({ files })).toThrow(
        "Manifest file 'deco.mcp.json' not found",
      );
    });

    it("should throw error for invalid JSON", () => {
      const files = new Map<string, Uint8Array>();
      files.set("deco.mcp.json", new TextEncoder().encode("invalid json{"));

      expect(() => parseManifestFromFiles({ files })).toThrow(UserInputError);
      expect(() => parseManifestFromFiles({ files })).toThrow("not valid JSON");
    });

    it("should throw error for missing slug or title", () => {
      const manifestContent = JSON.stringify({
        schemaVersion: "1.0",
        project: {
          slug: "",
          title: "",
        },
        author: {
          orgSlug: "test-org",
        },
        resources: {
          tools: [],
          views: [],
          workflows: [],
          documents: [],
        },
        dependencies: {
          mcps: [],
        },
        createdAt: new Date().toISOString(),
      });

      const files = new Map<string, Uint8Array>();
      files.set("deco.mcp.json", new TextEncoder().encode(manifestContent));

      expect(() => parseManifestFromFiles({ files })).toThrow(UserInputError);
      expect(() => parseManifestFromFiles({ files })).toThrow(UserInputError);
    });
  });

  describe("convertCodeFileToJson", () => {
    it("should convert a tool file to JSON", () => {
      const codeContent = `
export default async function execute(input, ctx) {
  return { success: true };
}

export const name = "TEST_TOOL";
export const description = "A test tool";
export const inputSchema = {"type": "object", "properties": {}};
export const outputSchema = {"type": "object", "properties": {}};
      `;

      const result = convertCodeFileToJson({
        path: "tools/test-tool.ts",
        contentBytes: new TextEncoder().encode(codeContent),
      });

      expect(result).not.toBeNull();
      expect(result?.finalPath).toBe("tools/test-tool.json");
      expect(result?.finalContentBytes).toBeInstanceOf(Uint8Array);

      const jsonContent = JSON.parse(
        new TextDecoder().decode(result!.finalContentBytes),
      );
      expect(jsonContent.name).toBe("TEST_TOOL");
    });

    it("should return null for non-code files", () => {
      const result = convertCodeFileToJson({
        path: "documents/readme.md",
        contentBytes: new TextEncoder().encode("# Readme"),
      });

      expect(result).toBeNull();
    });

    it("should return null for JSON files", () => {
      const result = convertCodeFileToJson({
        path: "tools/test.json",
        contentBytes: new TextEncoder().encode('{"name": "test"}'),
      });

      expect(result).toBeNull();
    });
  });

  describe("prepareFileForUpload", () => {
    it("should prepare a valid file for upload", () => {
      const content = '{"name": "test"}';
      const result = prepareFileForUpload({
        path: "tools/test.json",
        contentBytes: new TextEncoder().encode(content),
      });

      expect(result.shouldUpload).toBe(true);
      expect(result.remotePath).toBe("/src/tools/test.json");
      expect(result.base64Content).toBeTruthy();
    });

    it("should skip files not in allowed roots", () => {
      const content = "test content";
      const result = prepareFileForUpload({
        path: "README.md",
        contentBytes: new TextEncoder().encode(content),
      });

      expect(result.shouldUpload).toBe(false);
      expect(result.remotePath).toBe("");
    });

    it("should skip malformed JSON files", () => {
      const result = prepareFileForUpload({
        path: "tools/bad.json",
        contentBytes: new TextEncoder().encode("invalid json{"),
      });

      expect(result.shouldUpload).toBe(false);
    });

    it("should convert code files to JSON", () => {
      const codeContent = `
export default async function execute(input, ctx) {
  return { success: true };
}

export const name = "TEST_TOOL";
export const description = "A test tool";
export const inputSchema = {"type": "object", "properties": {}};
export const outputSchema = {"type": "object", "properties": {}};
      `;

      const result = prepareFileForUpload({
        path: "tools/test-tool.ts",
        contentBytes: new TextEncoder().encode(codeContent),
      });

      expect(result.shouldUpload).toBe(true);
      expect(result.remotePath).toBe("/src/tools/test-tool.json");
    });
  });

  describe("parseDatabaseSchema", () => {
    it("should parse a valid database schema", () => {
      const schema = {
        name: "users",
        createSql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
        indexes: [
          {
            name: "idx_users_name",
            sql: "CREATE INDEX idx_users_name ON users(name)",
          },
        ],
      };

      const result = parseDatabaseSchema({
        path: "database/users.json",
        contentBytes: new TextEncoder().encode(JSON.stringify(schema)),
      });

      expect(result).not.toBeNull();
      expect(result?.tableName).toBe("users");
      expect(result?.createSql).toContain("CREATE TABLE");
      expect(result?.indexes).toHaveLength(1);
      expect(result?.indexes[0].name).toBe("idx_users_name");
    });

    it("should return null for non-database files", () => {
      const result = parseDatabaseSchema({
        path: "tools/test.json",
        contentBytes: new TextEncoder().encode('{"name": "test"}'),
      });

      expect(result).toBeNull();
    });

    it("should return null for invalid schema", () => {
      const invalidSchema = {
        name: "users",
        // missing createSql
      };

      const result = parseDatabaseSchema({
        path: "database/users.json",
        contentBytes: new TextEncoder().encode(JSON.stringify(invalidSchema)),
      });

      expect(result).toBeNull();
    });

    it("should handle schemas without indexes", () => {
      const schema = {
        name: "users",
        createSql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
      };

      const result = parseDatabaseSchema({
        path: "database/users.json",
        contentBytes: new TextEncoder().encode(JSON.stringify(schema)),
      });

      expect(result).not.toBeNull();
      expect(result?.indexes).toEqual([]);
    });

    it("should filter out indexes without SQL", () => {
      const schema = {
        name: "users",
        createSql: "CREATE TABLE users (id INTEGER PRIMARY KEY)",
        indexes: [
          { name: "idx_valid", sql: "CREATE INDEX idx_valid ON users(id)" },
          { name: "idx_invalid", sql: "" },
          { name: "idx_missing" },
        ],
      };

      const result = parseDatabaseSchema({
        path: "database/users.json",
        contentBytes: new TextEncoder().encode(JSON.stringify(schema)),
      });

      expect(result).not.toBeNull();
      expect(result?.indexes).toHaveLength(1);
      expect(result?.indexes[0].name).toBe("idx_valid");
    });
  });

  describe("parseAgentFile", () => {
    it("should parse a valid agent file", () => {
      const agent = {
        name: "Test Agent",
        avatar: "https://example.com/avatar.png",
        instructions: "You are a helpful assistant",
        description: "A test agent",
        tools_set: { enabled: ["tool1", "tool2"] },
        max_steps: 10,
        max_tokens: 1000,
        model: "gpt-4",
        memory: { type: "short-term" },
        views: ["view1"],
        visibility: "PUBLIC",
        temperature: 0.7,
      };

      const result = parseAgentFile({
        path: "agents/test-agent.json",
        contentBytes: new TextEncoder().encode(JSON.stringify(agent)),
      });

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Test Agent");
      expect(result?.visibility).toBe("PUBLIC");
      expect(result?.model).toBe("gpt-4");
      expect(result?.temperature).toBe(0.7);
    });

    it("should return null for non-agent files", () => {
      const result = parseAgentFile({
        path: "tools/test.json",
        contentBytes: new TextEncoder().encode('{"name": "test"}'),
      });

      expect(result).toBeNull();
    });

    it("should handle null values", () => {
      const agent = {
        name: "Test Agent",
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

      const result = parseAgentFile({
        path: "agents/test-agent.json",
        contentBytes: new TextEncoder().encode(JSON.stringify(agent)),
      });

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Test Agent");
      expect(result?.visibility).toBeNull();
      expect(result?.avatar).toBeNull();
    });

    it("should validate visibility values", () => {
      const agentWithInvalidVisibility = {
        name: "Test Agent",
        visibility: "INVALID_VALUE",
      };

      const result = parseAgentFile({
        path: "agents/test-agent.json",
        contentBytes: new TextEncoder().encode(
          JSON.stringify(agentWithInvalidVisibility),
        ),
      });

      expect(result).not.toBeNull();
      expect(result?.visibility).toBeNull();
    });

    it("should accept valid visibility values", () => {
      const visibilityValues = ["PUBLIC", "WORKSPACE", "PRIVATE"];

      for (const visibility of visibilityValues) {
        const agent = {
          name: "Test Agent",
          visibility,
        };

        const result = parseAgentFile({
          path: "agents/test-agent.json",
          contentBytes: new TextEncoder().encode(JSON.stringify(agent)),
        });

        expect(result).not.toBeNull();
        expect(result?.visibility).toBe(visibility);
      }
    });

    it("should return null for malformed JSON", () => {
      const result = parseAgentFile({
        path: "agents/test-agent.json",
        contentBytes: new TextEncoder().encode("invalid json{"),
      });

      expect(result).toBeNull();
    });
  });
});
