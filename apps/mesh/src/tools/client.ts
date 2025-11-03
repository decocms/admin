import type { ToolBinder } from "@/core/define-tool";
import type z from "zod/v3";
import { MCPMeshTools } from "./index.ts";

export type MCPClient<TDefinition extends readonly ToolBinder<z.ZodTypeAny, z.ZodTypeAny>[]> = {
  [K in TDefinition[number]as K["name"]]: K extends ToolBinder<
    infer TInput,
    infer TReturn
  >
  ? (params: z.infer<TInput>, init?: RequestInit) => Promise<z.infer<TReturn>>
  : never;
};

export type MeshClient = MCPClient<MCPMeshTools>;
