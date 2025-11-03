import { useMemo } from "react";
import { useMatches, useParams } from "react-router";
import { useOrganizations } from "@deco/sdk";
import { useDocumentMetadata } from "./use-document-metadata.ts";

interface RouteHandle {
  title?: string;
}

/**
 * Hook that automatically sets the document title for org-level pages
 * Format: "Org Name › Page Name"
 *
 * Uses React Router's handle property to get the page title from route metadata
 */
export function useOrgDocumentTitle() {
  const { org: orgSlug } = useParams();
  const matches = useMatches();
  const { data: organizations } = useOrganizations();

  const currentOrg = useMemo(
    () => organizations?.find((organization) => organization.slug === orgSlug),
    [organizations, orgSlug],
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
      if (parts.length < 2) return "Projects";
      return parts.slice(1).join("/");
    }

    return "Projects";
  }, [matches]);

  const title = useMemo(() => {
    const orgName = currentOrg?.name ?? orgSlug;
    if (!orgName) return "deco";
    if (pageName === "Projects") return orgName;
    return `${orgName} › ${pageName}`;
  }, [currentOrg?.name, orgSlug, pageName]);

  useDocumentMetadata({ title });
}
