import { IntegrationPageLayout } from "./breadcrumb.tsx";
import { ConnectedAppsList } from "./connected-apps.tsx";

export default function Page() {
  return (
    <IntegrationPageLayout
      tabs={{
        connections: {
          title: "Apps",
          Component: ConnectedAppsList,
          initialOpen: true,
        },
      }}
    />
  );
}
