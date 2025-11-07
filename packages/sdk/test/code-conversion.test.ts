import { describe, it, expect } from "vitest";
import {
  viewJsonToCode,
  viewCodeToJson,
  toolJsonToCode,
  toolCodeToJson,
  workflowJsonToCode,
  workflowCodeToJson,
  type ViewResource,
  type ToolResource,
  type WorkflowResource,
} from "../src/mcp/projects/code-conversion.ts";

describe("code-conversion", () => {
  describe("Tool conversion", () => {
    it("should convert tool JSON to code and back", () => {
      const originalTool: ToolResource = {
        name: "FETCH_TODOS",
        description: "Fetch all todo items from the database",
        inputSchema: {
          type: "object",
          properties: {
            include_completed: {
              type: "boolean",
              default: true,
            },
          },
        },
        outputSchema: {
          type: "object",
          properties: {
            tasks: { type: "array" },
            total: { type: "number" },
          },
        },
        execute: `export default async function(input, ctx) {
  const { include_completed = true } = input;
  const result = await ctx.env['i:databases-management'].DATABASES_RUN_SQL({sql: 'SELECT * FROM todos'});
  return { tasks: result.tasks, total: result.total };
}`,
        dependencies: [
          {
            integrationId: "i:databases-management",
            toolNames: ["DATABASES_RUN_SQL"],
          },
        ],
      };

      // Convert to code
      const code = toolJsonToCode(originalTool);

      // Verify code structure
      expect(code).toContain("export default async function");
      expect(code).toContain("// Metadata exports");
      expect(code).toContain('export const name = "FETCH_TODOS"');
      expect(code).toContain("export const inputSchema =");
      expect(code).toContain("export const outputSchema =");
      expect(code).toContain("export const dependencies =");

      // Convert back to JSON
      const reconstructed = toolCodeToJson(code);

      // Verify all fields match
      expect(reconstructed.name).toBe(originalTool.name);
      expect(reconstructed.description).toBe(originalTool.description);
      expect(reconstructed.inputSchema).toEqual(originalTool.inputSchema);
      expect(reconstructed.outputSchema).toEqual(originalTool.outputSchema);
      expect(reconstructed.execute.trim()).toBe(originalTool.execute.trim());
      expect(reconstructed.dependencies).toEqual(originalTool.dependencies);
    });

    it("should handle tool without dependencies", () => {
      const tool: ToolResource = {
        name: "SIMPLE_TOOL",
        description: "A simple tool",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        execute: "export default async function(input, ctx) { return {}; }",
      };

      const code = toolJsonToCode(tool);
      const reconstructed = toolCodeToJson(code);

      expect(reconstructed.name).toBe(tool.name);
      expect(reconstructed.dependencies).toBeUndefined();
    });
  });

  describe("View conversion", () => {
    it("should convert view JSON to code and back", () => {
      const originalView: ViewResource = {
        name: "todo_list_view",
        description: "AI-Powered To-Do List",
        code: `import { useState } from 'react';

export const App = (props) => {
  const [tasks, setTasks] = useState([]);
  return <div>Todo List</div>;
};`,
        inputSchema: {
          type: "object",
          properties: {
            userId: { type: "string" },
          },
        },
        icon: "https://example.com/icon.png",
        tags: ["productivity", "todo"],
      };

      // Convert to code
      const code = viewJsonToCode(originalView);

      // Verify code structure
      expect(code).toContain("import { useState } from 'react'");
      expect(code).toContain("export const App");
      expect(code).toContain("// Metadata exports");
      expect(code).toContain('export const name = "todo_list_view"');
      expect(code).toContain("export const inputSchema =");
      expect(code).toContain("export const icon =");
      expect(code).toContain("export const tags =");

      // Convert back to JSON
      const reconstructed = viewCodeToJson(code);

      // Verify all fields match
      expect(reconstructed.name).toBe(originalView.name);
      expect(reconstructed.description).toBe(originalView.description);
      expect(reconstructed.code.trim()).toBe(originalView.code.trim());
      expect(reconstructed.inputSchema).toEqual(originalView.inputSchema);
      expect(reconstructed.icon).toBe(originalView.icon);
      expect(reconstructed.tags).toEqual(originalView.tags);
    });

    it("should handle view without optional fields", () => {
      const view: ViewResource = {
        name: "simple_view",
        description: "A simple view",
        code: "export const App = () => <div>Hello</div>;",
      };

      const code = viewJsonToCode(view);
      const reconstructed = viewCodeToJson(code);

      expect(reconstructed.name).toBe(view.name);
      expect(reconstructed.description).toBe(view.description);
      expect(reconstructed.code.trim()).toBe(view.code.trim());
      expect(reconstructed.inputSchema).toBeUndefined();
      expect(reconstructed.icon).toBeUndefined();
      expect(reconstructed.tags).toBeUndefined();
    });
  });

  describe("Workflow conversion", () => {
    it("should convert workflow JSON to code and back", () => {
      const originalWorkflow: WorkflowResource = {
        name: "todo_workflow",
        description: "Process todos",
        steps: [
          {
            def: {
              name: "fetch_todos",
              description: "Fetch all todos",
              execute:
                "export default async function(input, ctx) { return { todos: [] }; }",
              inputSchema: { type: "object" },
              outputSchema: { type: "object" },
            },
            input: { limit: 10 },
          },
          {
            def: {
              name: "process_todos",
              description: "Process the todos",
              execute:
                "export default async function(input, ctx) { return { processed: true }; }",
              inputSchema: { type: "object" },
              outputSchema: { type: "object" },
            },
          },
        ],
      };

      // Convert to code
      const code = workflowJsonToCode(originalWorkflow);

      // Verify code structure
      expect(code).toContain("// Step execution functions");
      expect(code).toContain("// Step: fetch_todos");
      expect(code).toContain("export const step_0_execute =");
      expect(code).toContain("// Step: process_todos");
      expect(code).toContain("export const step_1_execute =");
      expect(code).toContain("// Metadata exports");
      expect(code).toContain('export const name = "todo_workflow"');
      expect(code).toContain("export const stepsMetadata =");

      // Convert back to JSON
      const reconstructed = workflowCodeToJson(code);

      // Verify all fields match
      expect(reconstructed.name).toBe(originalWorkflow.name);
      expect(reconstructed.description).toBe(originalWorkflow.description);
      expect(reconstructed.steps).toHaveLength(2);
      expect(reconstructed.steps[0].def.name).toBe("fetch_todos");
      expect(reconstructed.steps[0].def.execute.trim()).toBe(
        originalWorkflow.steps[0].def.execute.trim(),
      );
      expect(reconstructed.steps[0].input).toEqual({ limit: 10 });
      expect(reconstructed.steps[1].def.name).toBe("process_todos");
    });
  });

  describe("Real-world FETCH_TODOS tool", () => {
    it("should handle the actual FETCH_TODOS tool from mcp-template-test", () => {
      const fetchTodosTool: ToolResource = {
        name: "FETCH_TODOS",
        description:
          "Fetch all todo items from the database, sorted by priority and date",
        inputSchema: {
          type: "object",
          properties: {
            include_completed: {
              type: "boolean",
              default: true,
              description: "Whether to include completed tasks",
            },
          },
          additionalProperties: false,
        },
        outputSchema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  description: { type: "string" },
                  priority: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                  },
                  completed: { type: "boolean" },
                  created_at: { type: "string" },
                  updated_at: { type: "string" },
                },
              },
            },
            total: { type: "number" },
          },
          required: ["tasks", "total"],
          additionalProperties: false,
        },
        execute: `export default async function(input, ctx) {
  const { include_completed = true } = input;
  
  let sql = \`SELECT id, description, priority, tags, completed, created_at, updated_at FROM todo_items\`;
  if (!include_completed) sql += \` WHERE completed = 0\`;
  sql += \` ORDER BY CASE WHEN priority = 'high' THEN 0 WHEN priority = 'medium' THEN 1 ELSE 2 END, completed ASC, created_at DESC\`;
  
  const result = await ctx.env['i:databases-management'].DATABASES_RUN_SQL({sql});
  
  if (!result.result[0] || !result.result[0].results) {
    return { tasks: [], total: 0 };
  }
  
  const tasks = result.result[0].results.map(row => ({
    ...row,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : (row.tags || []),
    completed: row.completed === 1 || row.completed === true
  }));
  
  return { tasks, total: tasks.length };
}`,
        dependencies: [
          {
            integrationId: "i:databases-management",
            toolNames: ["DATABASES_RUN_SQL"],
          },
        ],
      };

      // Convert to code
      const code = toolJsonToCode(fetchTodosTool);

      // Verify structure
      expect(code).toContain("export default async function(input, ctx)");
      expect(code).toContain("// Metadata exports");
      expect(code).toContain('export const name = "FETCH_TODOS"');

      // Convert back to JSON
      const reconstructed = toolCodeToJson(code);

      // Verify critical fields
      expect(reconstructed.name).toBe("FETCH_TODOS");
      expect(reconstructed.description).toBe(fetchTodosTool.description);
      expect(reconstructed.inputSchema).toEqual(fetchTodosTool.inputSchema);
      expect(reconstructed.outputSchema).toEqual(fetchTodosTool.outputSchema);
      expect(reconstructed.dependencies).toEqual(fetchTodosTool.dependencies);

      // Verify execute code is preserved
      expect(reconstructed.execute).toContain("include_completed");
      expect(reconstructed.execute).toContain("DATABASES_RUN_SQL");
      expect(reconstructed.execute).toContain("todo_items");
    });
  });
});
