import { useMemo } from "react";
import { useLocation, useParams } from "react-router";
import { useOrganizations } from "@deco/sdk";
import { useDocumentMetadata } from "./use-document-metadata.ts";

/**
 * Maps org-level route paths to human-readable page names
 */
function getOrgPageName(pathname: string): string {
  // Remove org from path
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return "Projects";

  const pagePath = parts.slice(1).join("/");

  // Route mappings for org-level pages
  const routeMap: Record<string, string> = {
    "": "Projects",
    members: "Members",
    billing: "Billing",
    models: "Models",
    usage: "Usage",
    settings: "Settings",
    "theme-editor": "Theme Editor",
  };

  return routeMap[pagePath] || pagePath;
}

/**
 * Hook that automatically sets the document title for org-level pages
 * Format: "Org Name › Page Name"
 */
export function useOrgDocumentTitle() {
  const { org: orgSlug } = useParams();
  const location = useLocation();
  const { data: organizations } = useOrganizations();

  const currentOrg = useMemo(
    () => organizations?.find((organization) => organization.slug === orgSlug),
    [organizations, orgSlug],
  );

  const pageName = useMemo(
    () => getOrgPageName(location.pathname),
    [location.pathname],
  );

  const title = useMemo(() => {
    const orgName = currentOrg?.name ?? orgSlug;
    if (!orgName) return "deco";
    if (pageName === "Projects") return orgName;
    return `${orgName} › ${pageName}`;
  }, [currentOrg?.name, orgSlug, pageName]);

  useDocumentMetadata({ title });
}
