import { useMemo } from "react";
import { useParams } from "react-router";
import { useProjects } from "@deco/sdk";
import { useEntityDocumentTitle } from "./use-entity-document-title.ts";

/**
 * Hook that automatically sets the document title based on the current project and page
 * Format: "Project Name › Page Name"
 *
 * Uses React Router's handle property to get the page title from route metadata
 */
export function useProjectDocumentTitle() {
  const { org, project: projectParam } = useParams();
  const projects = useProjects({ org: org ?? "" });

  const currentProject = useMemo(
    () => projects.find((project) => project.slug === projectParam),
    [projects, projectParam],
  );

  useEntityDocumentTitle({
    entity: currentProject,
    entitySlug: projectParam,
    getEntityName: (project, slug) => project?.title ?? slug ?? "deco",
    pathSliceIndex: 2,
    defaultPageName: "Home",
  });
}
