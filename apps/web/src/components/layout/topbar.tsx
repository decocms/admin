import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@deco/ui/components/toggle-group.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { ReportIssueButton } from "../common/report-issue-button.tsx";
import { LoggedUser, LoggedUserAvatarTrigger } from "../sidebar/footer";
import { DefaultBreadcrumb, TopbarControls } from "./project";
import { InboxPopover } from "./inbox-popover.tsx";
import { useParams } from "react-router";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useCopy } from "../../hooks/use-copy.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useExportProjectToZip } from "../../hooks/use-export-project.ts";

interface BreadcrumbItem {
  label: string | React.ReactNode;
  link?: string;
}

function SidebarToggle() {
  const { toggleSidebar } = useSidebar();

  return (
    <>
      <Button
        onClick={toggleSidebar}
        size="icon"
        variant="ghost"
        className="w-8 h-8 rounded-md"
      >
        <Icon
          name="dock_to_right"
          className="text-muted-foreground"
          size={20}
        />
      </Button>
      <div className="h-8 w-px bg-border" />
    </>
  );
}

function ExportButton() {
  const { org, project } = useParams();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [packageManager, setPackageManager] = useState<"bun" | "npm">("bun");
  const { handleCopy: handleCopyCommand, copied: copiedCommand } = useCopy();
  const { handleCopy: handleCopyInstall, copied: copiedInstall } = useCopy();
  const exportMutation = useExportProjectToZip();

  async function handleExport() {
    if (!org || !project) {
      toast.error("No project selected");
      return;
    }

    await exportMutation.mutateAsync({ org, project });
    setIsExportModalOpen(false);
  }

  // Only show in project context
  if (!org || !project) {
    return null;
  }

  const cliCommand = `deco project export --org ${org} --project ${project} --out ${project}/`;
  const installCommand = `${packageManager} install -g deco-cli@latest`;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              onClick={() => setIsExportModalOpen(true)}
            >
              <Icon
                name="download"
                className="text-muted-foreground"
                size={20}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Export Project</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Export Project</DialogTitle>
            <DialogDescription>
              Choose how you want to export your project
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-4">
            {/* Download ZIP Option */}
            <div className="flex flex-col items-center justify-center gap-4 p-6 border rounded-lg">
              <Icon name="download" size={36} />
              <div className="flex flex-col gap-2 items-center">
                <h3 className="text-lg font-medium">Download ZIP</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Export your project as a zip file containing all resources
                </p>
              </div>
              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending}
                size="sm"
              >
                {exportMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <Spinner />
                    Exporting...
                  </div>
                ) : (
                  "Export & Download"
                )}
              </Button>
            </div>

            {/* CLI Export Option */}
            <div className="flex flex-col gap-4 p-6 border rounded-lg">
              <h3 className="text-lg font-medium">Export via CLI</h3>

              <div className="flex flex-col gap-2">
                <label className="text-sm">Export Command</label>
                <div className="group relative bg-muted p-2 rounded-lg overflow-x-auto">
                  <code className="font-mono text-sm text-muted-foreground whitespace-nowrap block pr-8">
                    {cliCommand}
                  </code>
                  <button
                    onClick={() => handleCopyCommand(cliCommand)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-muted p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Icon
                      name={copiedCommand ? "check" : "content_copy"}
                      size={16}
                    />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Installation</label>
                  <ToggleGroup
                    type="single"
                    value={packageManager}
                    onValueChange={(value) =>
                      value && setPackageManager(value as "bun" | "npm")
                    }
                    className="gap-0 border rounded-md h-7"
                  >
                    <ToggleGroupItem
                      value="npm"
                      className="h-full px-1.5 text-sm data-[state=on]:bg-accent"
                    >
                      npm
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="bun"
                      className="h-full px-1.5 text-sm data-[state=on]:bg-accent"
                    >
                      bun
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="group relative bg-muted p-2 rounded-lg overflow-x-auto">
                  <code className="font-mono text-sm text-muted-foreground whitespace-nowrap block pr-8">
                    {installCommand}
                  </code>
                  <button
                    onClick={() => handleCopyInstall(installCommand)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-muted p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Icon
                      name={copiedInstall ? "check" : "content_copy"}
                      size={16}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Topbar({ breadcrumb }: { breadcrumb: BreadcrumbItem[] }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-20 bg-sidebar flex items-center justify-between w-full p-4 h-12 border-b border-border">
      <div className="flex items-center gap-2">
        <ErrorBoundary fallback={null}>
          <SidebarToggle />
        </ErrorBoundary>
        <DefaultBreadcrumb items={breadcrumb} useWorkspaceLink={false} />
      </div>
      <div className="flex items-center gap-2">
        <ExportButton />
        <Suspense fallback={null}>
          <InboxPopover />
        </Suspense>
        <ReportIssueButton />
        <Suspense fallback={null}>
          <TopbarControls />
        </Suspense>
        <LoggedUser
          trigger={(user) => <LoggedUserAvatarTrigger user={user} />}
          align="end"
        />
      </div>
    </div>
  );
}
