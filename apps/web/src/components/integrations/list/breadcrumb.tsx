import {
  useCreateIntegration,
  useIntegrations,
  useMarketplaceIntegrations,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { ReactNode } from "react";
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

  const { mutateAsync: createIntegration, isPending } = useCreateIntegration();
  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplaceIntegrations } = useMarketplaceIntegrations();

  const handleCreateIntegration = async () => {
    const { id } = await createIntegration({});
    navigate(withBasePath(`/integration/${id}`));
  };

  return (
    <PageLayout
      header={
        <>
          <div className="justify-self-start">
            <div className="flex gap-2">
              <BreadcrumbItem
                active={!!connected}
                label="Connected"
                count={installedIntegrations?.length ?? 0}
                to={withBasePath("/integrations")}
              />

              <BreadcrumbItem
                active={!connected}
                label="All"
                count={marketplaceIntegrations?.length ?? 0}
                to={withBasePath("/integrations/marketplace")}
              />
            </div>
          </div>
          <div>
            <Button onClick={handleCreateIntegration}>
              {isPending
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
      main={children}
    />
  );
}
