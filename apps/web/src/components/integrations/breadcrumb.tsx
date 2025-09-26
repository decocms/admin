import { useIntegrations } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useMatch } from "react-router";
import { ListPageHeader } from "../common/list-page-header.tsx";
import type { ViewModeSwitcherProps } from "../common/view-mode-switcher.tsx";

export const Header = ({
  query,
  setQuery,
  viewMode,
  setViewMode,
  actionsRight,
}: {
  query: string;
  setQuery: (query: string) => void;
  viewMode: ViewModeSwitcherProps["viewMode"];
  setViewMode: (viewMode: ViewModeSwitcherProps["viewMode"]) => void;
  actionsRight?: React.ReactNode;
}) => {
  const projectAppsViewActive = useMatch({
    path: `:org/:project/apps`,
  });

  const { data: installedIntegrations } = useIntegrations();
  // TODO: private integrations

  return (
    <ListPageHeader
      filter={{
        items: [
          {
            active: !!projectAppsViewActive,
            label: (
              <span className="flex items-center gap-2">
                <Icon name="groups" size={16} />
                Project
              </span>
            ),
            id: "installed",
            count:
              installedIntegrations?.filter(
                (integration) => integration.connection.type !== "INNATE",
              ).length ?? 0,
          },
          {
            active: !projectAppsViewActive,
            disabled: true,
            tooltip: "Coming soon",
            label: (
              <span className="flex items-center gap-2">
                <Icon name="lock" size={16} />
                Private
              </span>
            ),
            id: "all",
            count: 0,
          },
        ],
        onClick: () => {},
      }}
      input={{
        placeholder: "Search apps",
        value: query,
        onChange: (e) => setQuery(e.target.value),
      }}
      view={{ viewMode, onChange: setViewMode }}
      actionsRight={actionsRight}
    />
  );
};
