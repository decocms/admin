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
import { Input } from "@deco/ui/components/input.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useState } from "react";
import { Link, useMatch } from "react-router";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../../hooks/useNavigateWorkspace.ts";
import { Tab } from "../../dock/index.tsx";
import { PageLayout } from "../../layout.tsx";

function BreadcrumbItem({
  active,
  label,
  count,
  to,
}: {
  active: boolean;
  label: string;
  count: number;
  to: string;
}) {
  return (
    <Button
      asChild
      variant={active ? "secondary" : "outline"}
      className="shadow-none"
    >
      <Link to={to}>
        <span>{label}</span>
        <span className="text-xs text-slate-400">
          {count}
        </span>
      </Link>
    </Button>
  );
}

export function IntegrationPageLayout({ tabs }: { tabs: Record<string, Tab> }) {
  const navigateWorkspace = useNavigateWorkspace();
  const [error, setError] = useState<string | null>(null);

  const create = useCreateIntegration();
  const updateThreadMessages = useUpdateThreadMessages();

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
          <div className="flex items-center gap-3">
            <Icon name="widgets" />
            Integrations
          </div>
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
                  Creating...
                </>
              )
              : (
                <>
                  <Icon name="add" />
                  Create Integration
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

export const Breadcrumb = (
  { value, setValue }: { value: string; setValue: (value: string) => void },
) => {
  const workspaceLink = useWorkspaceLink();
  const connected = useMatch({ path: `:teamSlug?/integrations` });

  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplaceIntegrations } = useMarketplaceIntegrations();

  return (
    <div className="flex items-center justify-between flex-wrap">
      <div className="flex gap-2">
        <BreadcrumbItem
          active={!!connected}
          label="Connected"
          count={installedIntegrations?.filter((integration) =>
            integration.connection.type !== "INNATE"
          ).length ?? 0}
          to={workspaceLink("/integrations")}
        />

        <BreadcrumbItem
          active={!connected}
          label="All"
          count={marketplaceIntegrations?.integrations.length ?? 0}
          to={workspaceLink("/integrations/marketplace")}
        />
      </div>
      <div className="max-w-72 w-full">
        <Input
          className="rounded-xl w-full"
          placeholder="Filter integrations..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
    </div>
  );
};
