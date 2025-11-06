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
  DialogFooter,
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
import { MCPClient } from "@deco/sdk";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useCopy } from "../../hooks/use-copy.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";

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
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (!org || !project) {
      toast.error("No project selected");
      return;
    }

    setIsExporting(true);
    try {
      toast.info("Exporting project...");

      const result = await MCPClient.PROJECTS_EXPORT_ZIP({ org, project });

      // Convert base64 to blob and download
      const binaryString = atob(result.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Project exported successfully!");
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export project",
      );
    } finally {
      setIsExporting(false);
    }
  }

  // Only show in project context
  if (!org || !project) {
    return null;
  }

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Project</DialogTitle>
            <DialogDescription>
              Export your project as a zip file containing all tools, views,
              workflows, documents, database schemas, and agents. You can use
              this to back up your project, share it with others, or import it
              into another organization.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsExportModalOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <div className="flex items-center gap-2">
                  <Spinner />
                  Exporting...
                </div>
              ) : (
                <>
                  <Icon name="download" className="mr-2" size={16} />
                  Export & Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LinkButton() {
  const { org, project } = useParams();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [packageManager, setPackageManager] = useState<"bun" | "npm">("bun");
  const { handleCopy: handleCopyCommand, copied: copiedCommand } = useCopy();
  const { handleCopy: handleCopyInstall, copied: copiedInstall } = useCopy();

  // Only show in project context
  if (!org || !project) {
    return null;
  }

  const cliCommand = `deco project export --org ${org} --project ${project} --out ${project}/`;
  const installCommand = `${packageManager} install -g @deco/cli`;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              onClick={() => setIsLinkModalOpen(true)}
            >
              <Icon
                name="terminal"
                className="text-muted-foreground"
                size={20}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>CLI Export Instructions</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="space-y-3">
            <DialogTitle>Export via CLI</DialogTitle>
            <DialogDescription>
              Use the Deco CLI to export your project with full control over the export process.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Export Command</label>
                <Button
                  size="sm"
                  variant={copiedCommand ? "default" : "outline"}
                  onClick={() => handleCopyCommand(cliCommand)}
                  className="h-8 gap-1.5"
                >
                  <Icon name={copiedCommand ? "check" : "content_copy"} size={14} />
                  <span className="text-xs">{copiedCommand ? "Copied!" : "Copy"}</span>
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto border font-mono text-xs leading-relaxed">
                <code>{cliCommand}</code>
              </pre>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium">Installation</label>
                  <ToggleGroup
                    type="single"
                    value={packageManager}
                    onValueChange={(value) => value && setPackageManager(value as "bun" | "npm")}
                    className="gap-0 border rounded-md"
                  >
                    <ToggleGroupItem value="bun" className="h-7 px-3 text-xs data-[state=on]:bg-accent">
                      bun
                    </ToggleGroupItem>
                    <ToggleGroupItem value="npm" className="h-7 px-3 text-xs data-[state=on]:bg-accent">
                      npm
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <Button
                  size="sm"
                  variant={copiedInstall ? "default" : "outline"}
                  onClick={() => handleCopyInstall(installCommand)}
                  className="h-8 gap-1.5"
                >
                  <Icon name={copiedInstall ? "check" : "content_copy"} size={14} />
                  <span className="text-xs">{copiedInstall ? "Copied!" : "Copy"}</span>
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-md border font-mono text-xs">
                <code>{installCommand}</code>
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsLinkModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
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
        <LinkButton />
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
