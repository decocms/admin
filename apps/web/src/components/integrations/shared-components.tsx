import { Icon } from "@deco/ui/components/icon.tsx";
import { Avatar } from "../common/avatar/index.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import type { RegistryApp } from "@deco/sdk";
import type { CurrentTeam } from "../sidebar/team-selector.tsx";

// Grid components to match marketplace dialog layout
export function GridRightColumn({ children }: { children: React.ReactNode }) {
  return (
    <div data-right-column className="col-span-6 py-4">
      {children}
    </div>
  );
}

export function GridLeftColumn({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-left-column
      className="flex flex-col justify-between col-span-4 py-4 pr-4"
    >
      {children}
    </div>
  );
}

export function GridContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-grid-container
      className="flex-1 grid grid-cols-10 gap-6 h-full divide-x border-b"
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
      <div className="flex items-center justify-center absolute -translate-x-4 ml-17 w-8 h-8 bg-white border rounded-lg">
        <Icon name="sync_alt" size={24} className="text-muted-foreground" />
      </div>
    </div>
  );
}

export function IntegrationNotVerifiedAlert() {
  return (
    <div className="border-base bg-muted/10 text-base-foreground p-4 rounded-lg">
      <div className="flex items-start gap-3">
        <Icon
          name="warning"
          size={16}
          className="text-base-foreground mt-0.5"
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Third-party integration</span>
          </div>
          <p className="mt-1 text-sm">
            This integration is provided by a third party and is not maintained
            by deco.
          </p>
        </div>
      </div>
    </div>
  );
}
