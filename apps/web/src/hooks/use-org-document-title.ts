import { useMemo } from "react";
import { useParams } from "react-router";
import { useOrganizations } from "@deco/sdk";
import { useEntityDocumentTitle } from "./use-entity-document-title.ts";

/**
 * Hook that automatically sets the document title for org-level pages
 * Format: "Org Name › Page Name"
 *
 * Uses React Router's handle property to get the page title from route metadata
 */
export function useOrgDocumentTitle() {
  const { org: orgSlug } = useParams();
  const { data: organizations } = useOrganizations();

  const currentOrg = useMemo(
    () => organizations?.find((organization) => organization.slug === orgSlug),
    [organizations, orgSlug],
  );

  useEntityDocumentTitle({
    entity: currentOrg,
    entitySlug: orgSlug,
    getEntityName: (org, slug) => org?.name ?? slug ?? "deco",
    pathSliceIndex: 1,
    defaultPageName: "Projects",
  });
}
