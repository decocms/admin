import { useMemo } from "react";
import { useParams, useMatches } from "react-router";
import { useOrganizations } from "@deco/sdk";
import { useDocumentMetadata } from "./use-document-metadata.ts";

interface RouteHandle {
  title?: string;
}

/**
 * Hook that automatically sets the document title for org-level pages
 * Format: "Org Name | Page Name"
 *
 * Uses React Router's handle property to get the page title from route metadata
 */
export function useOrgDocumentTitle() {
  const { org: orgSlug } = useParams();
  const { data: organizations } = useOrganizations();
  const matches = useMatches();

  const currentOrg = useMemo(
    () => organizations?.find((organization) => organization.slug === orgSlug),
    [organizations, orgSlug],
  );

  const orgName = currentOrg?.name ?? orgSlug ?? "deco";

  // Get page name from route handle
  const pageName = useMemo(() => {
    for (let i = matches.length - 1; i >= 0; i--) {
      const handle = matches[i].handle as RouteHandle | undefined;
      if (handle?.title) {
        return handle.title;
      }
    }
    return "Projects";
  }, [matches]);

  const title = useMemo(() => {
    return `${orgName} | ${pageName}`;
  }, [orgName, pageName]);

  useDocumentMetadata({ title });
}
