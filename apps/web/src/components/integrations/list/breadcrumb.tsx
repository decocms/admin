import {
  useCreateIntegration,
  useIntegrations,
  useMarketplaceIntegrations,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { ReactNode, useState } from "react";
import { Link, useMatch, useNavigate } from "react-router";
import { useBasePath } from "../../../hooks/useBasePath.ts";
import { PageLayout } from "../../pageLayout.tsx";

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
    <Button asChild variant={active ? "secondary" : "outline"}>
      <Link to={to}>
        <span>{label}</span>
        <span className="text-xs text-slate-400">
          {count}
        </span>
      </Link>
    </Button>
  );
}

export function IntegrationPage({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const withBasePath = useBasePath();
  const connected = useMatch({ path: "/integrations" });
  const [error, setError] = useState<string | null>(null);

  const create = useCreateIntegration();
  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplaceIntegrations } = useMarketplaceIntegrations();

  const handleCreate = async () => {
    try {
      const result = await create.mutateAsync({});
      navigate(withBasePath(`/integration/${result.id}`));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create integration",
      );
    }
  };

  return (
    <>
      <PageLayout
        main={children}
        header={
          <>
            <div className="justify-self-start">
              <div className="flex gap-2">
                <BreadcrumbItem
                  active={!!connected}
                  label="Connected"
                  count={installedIntegrations?.filter((integration) =>
                    integration.connection.type !== "INNATE"
                  ).length ?? 0}
                  to={withBasePath("/integrations")}
                />

                <BreadcrumbItem
                  active={!connected}
                  label="All"
                  count={marketplaceIntegrations?.integrations.length ?? 0}
                  to={withBasePath("/integrations/marketplace")}
                />
              </div>
            </div>
            <div>
              <Button
                onClick={handleCreate}
                disabled={create.isPending}
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
            </div>
          </>
        }
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
