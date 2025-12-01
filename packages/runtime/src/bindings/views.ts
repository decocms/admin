import { ViewsListOutputSchema } from "../views.ts";
import { z } from "zod";
import type { ToolBinder } from "../mcp.ts";

export const VIEW_BINDING = [
  {
    name: "DECO_CHAT_VIEWS_LIST" as const,
    inputSchema: z.any(),
    outputSchema: ViewsListOutputSchema,
  },
] as const satisfies readonly ToolBinder[];

// Re-export for existing imports expecting listViewsSchema
export const listViewsSchema = ViewsListOutputSchema;
