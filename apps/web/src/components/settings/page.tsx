import { Tab } from "../dock/index.tsx";

import { Icon } from "@deco/ui/components/icon.tsx";
import AuditList from "../audit/list.tsx";
import { PageLayout } from "../layout.tsx";
import BillingSettings from "./billing.tsx";
import GeneralSettings from "./general.tsx";
import MembersSettings from "./members.tsx";
import UsageSettings from "./usage.tsx";

const TABS: Record<string, Tab> = {
  general: {
    title: "General",
    Component: GeneralSettings,
    initialOpen: true,
  },
  members: {
    title: "Members",
    Component: MembersSettings,
    initialOpen: true,
  },
  
  billing: {
    title: "Billing",
    Component: BillingSettings,
  },
  usage: {
    title: "Usage",
    Component: UsageSettings,
  },
};

export default function SettingsPage() {
  return (
    <PageLayout
      breadcrumb={
        <div className="flex items-center gap-3">
          <Icon name="settings" />
          Settings
        </div>
      }
      tabs={TABS}
    />
  );
}
