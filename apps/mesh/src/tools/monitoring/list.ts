/**
 * MONITORING_LOGS_LIST Tool
 *
 * Lists monitoring logs for the organization with filtering options.
 */

import { requireOrganization } from "@/core/mesh-context";
import { defineTool } from "../../core/define-tool";
import { z } from "zod";

export const MONITORING_LOGS_LIST = defineTool({
  name: "MONITORING_LOGS_LIST",
  description: "List monitoring logs for tool calls in the organization",
  inputSchema: z.object({
    connectionId: z.string().optional().describe("Filter by connection ID"),
    toolName: z.string().optional().describe("Filter by tool name"),
    isError: z.boolean().optional().describe("Filter by error status"),
    startDate: z
      .string()
      .optional()
      .describe("Filter by start date (ISO string)"),
    endDate: z.string().optional().describe("Filter by end date (ISO string)"),
    limit: z.number().default(100).describe("Maximum number of results"),
    offset: z.number().default(0).describe("Offset for pagination"),
  }),
  handler: async (input, ctx) => {
    const org = requireOrganization(ctx);

    const filters = {
      organizationId: org.id,
      connectionId: input.connectionId,
      toolName: input.toolName,
      isError: input.isError,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      limit: input.limit,
      offset: input.offset,
    };

    const logs = await ctx.storage.monitoring.query(filters);

    return {
      logs,
      total: logs.length,
      offset: input.offset,
      limit: input.limit,
    };
  },
});
