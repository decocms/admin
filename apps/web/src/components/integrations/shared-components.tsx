import { Icon } from "@deco/ui/components/icon.tsx";
import { Avatar } from "../common/avatar/index.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import type { RegistryApp } from "@deco/sdk";
import type { CurrentTeam } from "../sidebar/team-selector.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

// Grid components to match marketplace dialog layout
export function GridRightColumn({ children }: { children: React.ReactNode }) {
  return (
    <div data-right-column className="col-span-6 py-4 max-h-133 pl-2 overflow-y-scroll">
      {children}
    </div>
  );
}

export function GridLeftColumn({ children }: { children: React.ReactNode }) {
  return (
    <div data-left-column className="flex flex-col col-span-4">
      <img
        src="/img/oauth-modal-banner.png?v=0"
        alt="OAuth Modal Banner"
        className="w-full object-cover"
      />
      {children}
    </div>
  );
}

export function GridContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-grid-container
      className={cn("grid grid-cols-10 gap-6 divide-x", className)}
    >
      {children}
    </div>
  );
}

export function IntegrationWorkspaceIcon({
  app,
  project,
}: {
  app: RegistryApp;
  project: CurrentTeam;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Left app icon */}
      <div className="rounded-lg flex items-center justify-center">
        <IntegrationAvatar
          url={app.icon}
          fallback={app.friendlyName ?? app.name}
          size="xl"
        />
      </div>

      {/* Right workspace icon */}
      <div className="rounded-lg flex items-center justify-center">
        <Avatar
          shape="square"
          url={project.avatarUrl}
          fallback={project.label}
          objectFit="contain"
          size="xl"
        />
      </div>

      {/* Connection arrow */}
      <div className="flex items-center justify-center absolute -translate-x-4 ml-17 w-8 h-8 bg-background border rounded-lg">
        <Icon name="sync_alt" size={24} className="text-muted-foreground" />
      </div>
    </div>
  );
}
