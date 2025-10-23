import { type ReactNode, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { useHideLegacyFeatures } from "../../hooks/use-hide-legacy-features.ts";
import { useTrackNativeViewVisit, useSDK, type View } from "@deco/sdk";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";

/**
 * Documents resource list component that renders the ResourcesV2List
 * with the specific integration ID for documents management
 */
export function DocumentsResourceList({
  headerSlot,
}: {
  headerSlot?: ReactNode;
} = {}) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigateWorkspace = useNavigateWorkspace();
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();
  const { showLegacyFeature } = useHideLegacyFeatures();
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const team = useCurrentTeam();

  // Find the Documents view ID
  const documentsViewId = useMemo(() => {
    const views = (team?.views ?? []) as View[];
    const legacyTitleMap: Record<string, string> = { Prompts: "Documents" };
    const canonicalTitle = (title: string) => legacyTitleMap[title] ?? title;
    const view = views.find((v) => canonicalTitle(v.title) === "Documents");
    return view?.id;
  }, [team?.views]);

  // Track visit to Documents page for recents (only if unpinned)
  useTrackNativeViewVisit({
    viewId: documentsViewId || "documents-fallback",
    viewTitle: "Documents",
    viewIcon: "docs",
    viewPath: `/${projectKey}/documents`,
    projectKey,
  });

  // Automatically open Decopilot if openDecopilot query param is present
  useEffect(() => {
    const openDecopilot = searchParams.get("openDecopilot") === "true";
    if (openDecopilot) {
      setDecopilotOpen(true);
    }
  }, [searchParams, setDecopilotOpen]);

  // Determine active tab based on current route
  const activeTab = useMemo(() => {
    const pathname = location.pathname;
    if (pathname.includes("/documents/prompts")) return "prompts";
    return "all";
  }, [location.pathname]);

  return (
    <ResourcesV2List
      integrationId="i:documents-management"
      resourceName="document"
      headerSlot={headerSlot}
      tabs={[
        {
          id: "all",
          label: "All",
          onClick: () => navigateWorkspace("/documents"),
        },
        ...(showLegacyFeature("hideLegacyPrompts")
          ? [
              {
                id: "prompts",
                label: "Prompts (Legacy)",
                onClick: () => navigateWorkspace("/documents/prompts"),
              },
            ]
          : []),
      ]}
      activeTab={activeTab}
    />
  );
}

export default DocumentsResourceList;
