import { ListPageHeader } from "../../common/list-page-header.tsx";
import type { ViewModeSwitcherProps } from "../../common/view-mode-switcher.tsx";

export const Header = ({
  value,
  setValue,
  viewMode,
  setViewMode,
  actionsRight,
}: {
  value: string;
  setValue: (value: string) => void;
  viewMode: ViewModeSwitcherProps["viewMode"];
  setViewMode: (viewMode: ViewModeSwitcherProps["viewMode"]) => void;
  actionsRight?: React.ReactNode;
}) => {
  return (
    <ListPageHeader
      input={{
        placeholder: "Search document",
        value: value,
        onChange: (e) => setValue(e.target.value),
      }}
      view={{ viewMode, onChange: setViewMode }}
      controlsAlign="start"
      actionsRight={actionsRight}
    />
  );
};
