import { useMemo } from "react";
import { useParams } from "react-router";
import { useProjects, WELL_KNOWN_AGENTS } from "@deco/sdk";
import { useThread } from "../components/decopilot/thread-provider.tsx";
import { useThreadTitle } from "../components/decopilot/index.tsx";
import { useDocumentMetadata } from "./use-document-metadata.ts";

/**
 * Hook that automatically sets the document title based on the current project and thread
 * Format: "Project Name | Thread Title"
 */
export function useProjectDocumentTitle() {
  const { org, project: projectParam } = useParams();
  const projects = useProjects({ org: org ?? "" });
  const { activeThreadId } = useThread();

  const currentProject = useMemo(
    () => projects.find((project) => project.slug === projectParam),
    [projects, projectParam],
  );

  const projectName = currentProject?.title ?? projectParam ?? "deco";

  const threadTitle = useThreadTitle(
    activeThreadId ?? undefined,
    WELL_KNOWN_AGENTS.decopilotAgent.id,
    "New chat",
  );

  const title = useMemo(() => {
    return `${projectName} | ${threadTitle}`;
  }, [projectName, threadTitle]);

  useDocumentMetadata({ title });
}
