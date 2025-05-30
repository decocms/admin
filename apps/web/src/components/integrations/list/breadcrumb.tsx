import {
  useCreateIntegration,
  useIntegrations,
  useMarketplaceIntegrations,
  useUpdateThreadMessages,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useEffect, useState } from "react";
import { useMatch } from "react-router";
import { useNavigateWorkspace } from "../../../hooks/use-navigate-workspace.ts";
import { ListPageHeader } from "../../common/ListPageHeader.tsx";
import { ViewModeSwitcherProps } from "../../common/ViewModelSwitcher.tsx";
import { Tab } from "../../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../../layout.tsx";

const isUUID = (uuid: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

export function IntegrationPageLayout({ tabs }: { tabs: Record<string, Tab> }) {
  const navigateWorkspace = useNavigateWorkspace();
  const [error, setError] = useState<string | null>(null);

  const create = useCreateIntegration();
  const updateThreadMessages = useUpdateThreadMessages();

  useEffect(() => {
    const url = new URL(globalThis.location.href);
    const mcpUrl = url.searchParams.get("mcpUrl");

    const uuid = mcpUrl?.split("/").at(-3);

    if (typeof uuid === "string" && isUUID(uuid)) {
      navigateWorkspace(`/integration/${uuid}`);
    }
  }, []);

  const handleCreate = async () => {
    try {
      const result = await create.mutateAsync({});
      updateThreadMessages(result.id);
      navigateWorkspace(`/integration/${result.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create integration",
      );
    }
  };

  return (
    <>
      <PageLayout
        displayViewsTrigger={false}
        breadcrumb={
          <DefaultBreadcrumb
            items={[{ label: "Integrations", link: "/integrations" }]}
          />
        }
        actionButtons={
          <Button
            onClick={handleCreate}
            disabled={create.isPending}
            variant="special"
            className="gap-2"
          >
            {create.isPending
              ? (
                <>
                  <Spinner size="xs" />
                  <span>Creating...</span>
                </>
              )
              : (
                <>
                  <Icon name="add" />
                  <span className="hidden md:inline">New Integration</span>
                </>
              )}
          </Button>
        }
        tabs={tabs}
      />
      <AlertDialog open={!!error} onOpenChange={() => setError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>
              {error}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setError(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const Header = (
  {
    value,
    setValue,
    viewMode,
    setViewMode,
  }: {
    value: string;
    setValue: (value: string) => void;
    viewMode: ViewModeSwitcherProps["viewMode"];
    setViewMode: (viewMode: ViewModeSwitcherProps["viewMode"]) => void;
  },
) => {
  const navigateWorkspace = useNavigateWorkspace();
  const connected = useMatch({ path: `:teamSlug?/integrations` });

  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplaceIntegrations } = useMarketplaceIntegrations();

  return (
    <ListPageHeader
      filter={{
        items: [{
          active: !!connected,
          label: "Connected",
          id: "connected",
          count: installedIntegrations?.filter((integration) =>
            integration.connection.type !== "INNATE"
          ).length ?? 0,
        }, {
          active: !connected,
          label: "All",
          id: "all",
          count: marketplaceIntegrations?.integrations.length ?? 0,
        }],
        onClick: (item) => {
          if (item.id === "connected") {
            navigateWorkspace("/integrations");
          } else {
            navigateWorkspace("/integrations/marketplace");
          }
        },
      }}
      input={{
        placeholder: "Search integration",
        value: value,
        onChange: (e) => setValue(e.target.value),
      }}
      view={{ viewMode, onChange: setViewMode }}
    />
  );
};
