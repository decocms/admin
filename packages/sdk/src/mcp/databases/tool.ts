import { createToolGroup } from "../context.ts";

export const createDatabaseTool = createToolGroup("Databases", {
  name: "Databases",
  description: "Query workspace database",
  icon:
    "https://assets.decocache.com/mcp/390f7756-ec01-47e4-bb31-9e7b18f6f56f/database.png",
});
