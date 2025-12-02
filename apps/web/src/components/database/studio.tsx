import { DECO_CMS_API_URL } from "@deco/sdk";
import { useParams } from "react-router";
import { useState } from "react";
import { PreviewIframe } from "../agent/preview.tsx";
import { useToolCallListener } from "../../hooks/use-tool-call-listener.ts";

export default function DatabaseStudio() {
  const { org, project } = useParams<{ org: string; project: string }>();
  const integrationId = "i:databases-management";

  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for DATABASES_RUN_SQL tool calls with CREATE TABLE
  useToolCallListener((toolCall) => {
    if (toolCall.toolName.endsWith("DATABASES_RUN_SQL")) {
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
    <div className="h-full w-full">
      <PreviewIframe
        key={refreshKey}
        src={studioUrl}
        title="Database Studio"
        className="w-full h-full border-0"
      />
    </div>
  );
}
