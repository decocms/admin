import { useIntegrations, useMarketplaceIntegrations } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Link, useMatch } from "react-router";
import { useBasePath } from "../../../hooks/useBasePath.ts";
import { Topbar } from "../../topbar/index.tsx";

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

export function IntegrationTopbar() {
  const withBasePath = useBasePath();
  const connected = useMatch({ path: "/integrations" });

  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplaceIntegrations } = useMarketplaceIntegrations();

  return (
    <Topbar>
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
            count={marketplaceIntegrations?.integrations.length ?? 0}
            to={withBasePath("/integrations/marketplace")}
          />
        </div>
      </div>
      <div>
        <Button asChild>
          <Link to={withBasePath("/integration/new")}>
            <Icon name="add" />
            Create Integration
          </Link>
        </Button>
      </div>
    </Topbar>
  );
}
