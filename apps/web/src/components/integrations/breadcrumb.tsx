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
  return (
    <ListPageHeader
      input={{
        placeholder: "Search context",
        value: query,
        onChange: (e) => setQuery(e.target.value),
      }}
      view={{ viewMode, onChange: setViewMode }}
      actionsRight={actionsRight}
    />
  );
};
