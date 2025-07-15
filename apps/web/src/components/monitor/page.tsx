import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import UsageSettings from "../settings/usage.tsx";
import { AuditList } from "../audit/list.tsx";

const TABS: Record<string, Tab> = {
  activity: {
    title: "Activity",
    Component: AuditList,
    initialOpen: true,
    active: true,
  },
  usage: {
    title: "Usage",
    Component: UsageSettings,
    initialOpen: true,
  },
};

export default function MonitorPage() {
  return (
    <PageLayout
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Monitor", link: "/monitor" }]} />
      }
    />
  );
}
