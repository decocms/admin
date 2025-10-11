import { ViewsResourceList } from "./views-resource-list.tsx";
import { ViewsTabs } from "./tabs-nav.tsx";

export default function ViewsListPage() {
  return <ViewsResourceList headerSlot={<ViewsTabs active="views" />} />;
}
