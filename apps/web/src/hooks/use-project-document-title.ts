import { useMemo } from "react";
import { useMatches, useParams } from "react-router";
import { useProjects } from "@deco/sdk";
import { useDocumentMetadata } from "./use-document-metadata.ts";

interface RouteHandle {
  title?: string;
}

/**
 * Hook that automatically sets the document title based on the current project and page
 * Format: "Project Name › Page Name"
 * 
 * Uses React Router's handle property to get the page title from route metadata
 */
export function useProjectDocumentTitle() {
  const { org, project: projectParam } = useParams();
  const matches = useMatches();
  const projects = useProjects({ org: org ?? "" });

  const currentProject = useMemo(
    () => projects.find((project) => project.slug === projectParam),
    [projects, projectParam],
  );

  // Get the title from the last matched route with a handle
  const pageName = useMemo(() => {
    // First, try to get title from route handle
    for (let i = matches.length - 1; i >= 0; i--) {
      const handle = matches[i].handle as RouteHandle | undefined;
      if (handle?.title) {
        return handle.title;
      }
    }

    // Fallback: extract path from last match
    const lastMatch = matches[matches.length - 1];
    if (lastMatch?.pathname) {
      const parts = lastMatch.pathname.split("/").filter(Boolean);
      if (parts.length < 3) return "Home";
      
      const pagePath = parts.slice(2).join("/");
      
      // Fallback: capitalize first part of the path
      const firstPart = pagePath.split("/")[0];
      return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
    }

    return "Home";
  }, [matches]);

  const title = useMemo(() => {
    const projectName = currentProject?.title ?? projectParam;
    if (!projectName) return "deco";
    if (pageName === "Home") return projectName;
    return `${projectName} › ${pageName}`;
  }, [currentProject?.title, projectParam, pageName]);

  useDocumentMetadata({ title });
}
