import type { ToolBinder } from "@/core/define-tool";
import type z from "zod/v3";
import { MCPMeshTools } from "./index.ts";

export type MCPClient<
  T extends readonly ToolBinder<z.ZodTypeAny, z.ZodTypeAny>[],
> = {
  [K in T[number]["name"]]: (
    args: z.infer<T[number]["inputSchema"]>,
  ) => Promise<
    T[number]["outputSchema"] extends infer R
      ? R extends z.ZodTypeAny
        ? z.infer<R>
        : unknown
      : unknown
  >;
};

export type MeshClient = MCPClient<MCPMeshTools>;
