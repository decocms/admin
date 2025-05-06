import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { SETTINGS_ITEMS, type SettingsPage } from "../sidebar/settings.tsx";

interface SettingsMobileHeaderProps {
  currentPage: Lowercase<SettingsPage>;
}

export function SettingsMobileHeader(
  { currentPage }: SettingsMobileHeaderProps,
) {
  const { toggleSidebar } = useSidebar();

  const currentItem = SETTINGS_ITEMS.find(
    (item) => item.title.toLowerCase() === currentPage,
  ) || SETTINGS_ITEMS[0];

  return (
    <div className="md:hidden flex items-center justify-between w-full h-14 px-4 bg-slate-100 text-slate-700">
      <Button
        variant="ghost"
        size="icon"
        className="flex-none"
        onClick={toggleSidebar}
      >
        <Icon name="menu" weight={300} size={20} />
      </Button>

      <div className="flex items-center justify-center flex-grow">
        <Icon name={currentItem.icon} className="mr-2" size={20} />
        <span className="font-medium">{currentItem.title}</span>
      </div>

      <div className="w-9 flex-none"></div>
    </div>
  );
}
