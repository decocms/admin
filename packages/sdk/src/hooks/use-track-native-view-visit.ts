import { useEffect, useRef } from "react";
import { useRecentResources } from "./use-recent-resources.ts";
import { useUnpinnedNativeViews } from "./use-unpinned-native-views.ts";

interface TrackNativeViewVisitOptions {
  viewId: string;
  viewTitle: string;
  viewIcon: string;
  viewPath: string;
  projectKey?: string;
}

/**
 * Hook to track visits to native view pages (Documents, Agents, Workflows, etc.)
 * Only adds to recents if the view is currently unpinned.
 */
export function useTrackNativeViewVisit({
  viewId,
  viewTitle,
  viewIcon,
  viewPath,
  projectKey,
}: TrackNativeViewVisitOptions) {
  const { addRecent } = useRecentResources(projectKey);
  const { isViewUnpinned } = useUnpinnedNativeViews(projectKey);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // Only track once per mount and only if unpinned
    if (hasTrackedRef.current || !projectKey || !viewId) return;

    const isUnpinned = isViewUnpinned(viewId);

    if (!isUnpinned) return;

    hasTrackedRef.current = true;

    // Use setTimeout to avoid state updates during render
    setTimeout(() => {
      addRecent({
        id: viewId,
        name: viewTitle,
        type: "view",
        icon: viewIcon,
        path: viewPath,
      });
    }, 0);
  }, [
    viewId,
    viewTitle,
    viewIcon,
    viewPath,
    projectKey,
    isViewUnpinned,
    addRecent,
  ]);
}
