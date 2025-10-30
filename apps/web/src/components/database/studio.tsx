import { DECO_CMS_API_URL, useIntegration, useTools } from "@deco/sdk";
import { useMemo } from "react";
import { useParams } from "react-router";
import { useState } from "react";
import { PreviewIframe } from "../agent/preview.tsx";
import { useSetThreadContextEffect } from "../decopilot/thread-context-provider.tsx";
import { useToolCallListener } from "../../hooks/use-tool-call-listener.ts";

export default function DatabaseStudio() {
  const { org, project } = useParams<{ org: string; project: string }>();
  const integrationId = "i:databases-management";

  // Get integration and tools for database management
  const integration = useIntegration(integrationId).data;
  const connection = integration?.connection;
  const toolsQuery = useTools(connection!, false);
  const tools = toolsQuery?.data?.tools ?? [];

  // Prepare thread context items for database management
  const threadContextItems = useMemo(() => {
    if (!integrationId) return [];

    const contextItems = [];

    // Add rule context items
    const rules: string[] = [
      "You are helping with database management. You can run SQL queries, and assist with database operations.",
      "When the user asks about the database, use DATABASES_RUN_SQL to execute queries.",
      "Always explain query results clearly and suggest optimizations when relevant.",
    ];

    contextItems.push(
      ...rules.map((text) => ({
        id: crypto.randomUUID(),
        type: "rule" as const,
        text,
      })),
    );

    // Add toolset context item
    if (tools.length > 0) {
      contextItems.push({
        id: crypto.randomUUID(),
        type: "toolset" as const,
        integrationId,
        enabledTools: tools.map((tool) => tool.name),
      });
    }

    return contextItems;
  }, [integrationId, tools]);

  // Inject context into the current route's thread
  useSetThreadContextEffect(threadContextItems);
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for DATABASES_RUN_SQL tool calls with CREATE TABLE
  useToolCallListener((toolCall) => {
    if (toolCall.toolName === "DATABASES_RUN_SQL") {
      const input = toolCall.input as { sql?: string } | undefined;
      const sql = input?.sql;

      // Check if SQL contains CREATE TABLE (case insensitive)
      if (sql && /CREATE\s+TABLE/i.test(sql)) {
        // Force iframe refresh by updating the key
        setRefreshKey((prev) => prev + 1);
      }
    }
  });

  if (!org || !project) {
    return null;
  }

  const studioUrl = `${DECO_CMS_API_URL}/${org}/${project}/${integrationId}/studio`;

  return (
    <div className="h-[calc(100vh-48px)] w-full">
      <PreviewIframe
        key={refreshKey}
        src={studioUrl}
        title="Database Studio"
        className="w-full h-full border-0"
      />
    </div>
  );
}
