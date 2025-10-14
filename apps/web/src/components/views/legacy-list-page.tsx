import { lazy } from "react";
import { TabbedPageLayout } from "../common/tabbed-page-layout.tsx";

const ViewsListLegacy = lazy(() => import("./list.tsx"));

export default function ViewsLegacyPage() {
  return (
    <TabbedPageLayout
      component={ViewsListLegacy}
      title="Views"
      tabs={[
        { id: "all", label: "All", path: "/views" },
        { id: "legacy", label: "Legacy", path: "/views/legacy" },
      ]}
      getActiveTab={(pathname) =>
        pathname.includes("/views/legacy") ? "legacy" : "all"
      }
      viewModeKey="views-legacy"
    />
  );
}
