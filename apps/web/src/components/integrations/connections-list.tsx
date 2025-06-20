import { IntegrationPageLayout } from "./breadcrumb.tsx";
import { ConnectedAppsList } from "./connected-apps.tsx";

export default function Page() {
  return (
    <IntegrationPageLayout
      tabs={{
        connections: {
          title: "Integrations",
          Component: ConnectedAppsList,
          initialOpen: true,
        },
      }}
    />
  );
}
