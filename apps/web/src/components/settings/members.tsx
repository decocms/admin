import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

export default function MembersSettings() {
  return (
    <div className="container h-full max-w-7xl">
      <SettingsMobileHeader currentPage="members" />
      <div className="p-6 h-[calc(100%-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center text-center max-w-md gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
            <Icon name="group" size={32} className="text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold">Team Members</h1>
          <p className="text-muted-foreground">
            Coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
