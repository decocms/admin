import { useMemo } from "react";
import { useTrackNativeViewVisit, useSDK, type View } from "@deco/sdk";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { BrowserRenderingView } from "./browser-rendering-view.tsx";

export function BrowserRenderingResourceList() {
  const { locator } = useSDK();
  const team = useCurrentTeam();

  const projectKey = typeof locator === "string" ? locator : undefined;
  const browserRenderingViewId = useMemo(() => {
    const views = (team?.views ?? []) as View[];
    const view = views.find((v) => v.title === "Browser");
    return view?.id;
  }, [team?.views]);

  // Track visit for recents/pinning
  useTrackNativeViewVisit({
    viewId: browserRenderingViewId || "browser-rendering-fallback",
    viewTitle: "Browser",
    viewIcon: "camera",
    viewPath: `/${projectKey}/browser-rendering`,
    projectKey,
  });

  return <BrowserRenderingView />;
}

