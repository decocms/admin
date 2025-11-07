import { AgentDetail } from "../agent/agent-detail.tsx";
import { DocumentDetail } from "../documents/document-detail.tsx";
import { ToolDetail } from "../tools/tool-detail.tsx";
import { WorkflowDisplay } from "../workflow-builder/workflow-display-canvas.tsx";
import { WorkflowRunDetail } from "../workflows/workflow-run-detail.tsx";
import { ViewDetail } from "../views/view-detail.tsx";

/**
 * Registry of well-known view components mapped by integrationId:resourceName keys.
 * Used by ResourceDetailView in canvas-tab-content.tsx to render detail views.
 *
 * Keys are in the format: `${integrationId}:${resourceName}`
 *
 * Examples:
 * - i:agent-management:agent
 * - i:workflows-management:workflow
 * - i:workflows-management:workflow_run
 * - i:tools-management:tool
 * - i:documents-management:document
 * - i:views-management:view
 */
export const WELL_KNOWN_VIEWS = {
  "i:agent-management:agent": AgentDetail,
  "i:workflows-management:workflow": WorkflowDisplay,
  "i:workflows-management:workflow_run": WorkflowRunDetail,
  "i:tools-management:tool": ToolDetail,
  "i:documents-management:document": DocumentDetail,
  "i:views-management:view": ViewDetail,
};
