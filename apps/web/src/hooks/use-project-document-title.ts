import { useMemo } from "react";
import { useLocation, useParams } from "react-router";
import { useProjects } from "@deco/sdk";
import { useDocumentMetadata } from "./use-document-metadata.ts";

/**
 * Maps route paths to human-readable page names
 */
function getPageName(pathname: string): string {
  // Remove org and project from path
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 3) return "Home";

  const pagePath = parts.slice(2).join("/");

  // Route mappings - keeping Linear's concise style
  const routeMap: Record<string, string> = {
    "": "Home",
    store: "Store",
    discover: "Store",
    tools: "Tools",
    agents: "Agents",
    "agents/threads": "Threads",
    apps: "Apps",
    database: "Database",
    views: "Views",
    "views/legacy": "Views (Legacy)",
    documents: "Documents",
    "documents/prompts": "Prompts",
    workflows: "Workflows",
    "workflows/runs": "Workflow Runs",
    "workflows/runs-legacy": "Workflow Runs (Legacy)",
    "workflows/triggers": "Triggers",
    activity: "Activity",
  };

  // Check for exact match first
  if (routeMap[pagePath]) {
    return routeMap[pagePath];
  }

  // Handle dynamic routes
  if (pagePath.startsWith("agent/")) {
    return "Agent";
  }
  if (pagePath.startsWith("apps/")) {
    if (pagePath === "apps/success") return "App Installed";
    return "App Details";
  }
  if (pagePath.startsWith("trigger/")) {
    return "Trigger";
  }
  if (pagePath.startsWith("views/")) {
    return "View";
  }
  if (pagePath.startsWith("documents/")) {
    return "Document";
  }
  if (pagePath.startsWith("workflow-runs/")) {
    return "Workflow Run";
  }
  if (pagePath.startsWith("audit/")) {
    return "Audit";
  }
  if (pagePath.startsWith("rsc/")) {
    return "Resource";
  }

  // Fallback: capitalize first part
  const firstPart = pagePath.split("/")[0];
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
}

/**
 * Hook that automatically sets the document title based on the current project and page
 * Format: "Project Name › Page Name"
 */
export function useProjectDocumentTitle() {
  const { org, project: projectParam } = useParams();
  const location = useLocation();
  const projects = useProjects({ org: org ?? "" });

  const currentProject = useMemo(
    () => projects.find((project) => project.slug === projectParam),
    [projects, projectParam],
  );

  const pageName = useMemo(
    () => getPageName(location.pathname),
    [location.pathname],
  );

  const title = useMemo(() => {
    const projectName = currentProject?.title ?? projectParam;
    if (!projectName) return "deco";
    if (pageName === "Home") return projectName;
    return `${projectName} › ${pageName}`;
  }, [currentProject?.title, projectParam, pageName]);

  useDocumentMetadata({ title });
}
