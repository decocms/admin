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
                <>
                  <Spinner className="mr-2" />
                  Exporting...
                </>
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
  const { copy, isCopied } = useCopy();

  // Only show in project context
  if (!org || !project) {
    return null;
  }

  const cliCommand = `deco project export --org ${org} --project ${project} --out ${project}/`;

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export via CLI</DialogTitle>
            <DialogDescription>
              Use the Deco CLI to export your project with full control over the
              export process.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Run this command in your terminal:
              </p>
              <div className="flex items-start gap-2">
                <pre className="flex-1 bg-muted p-3 rounded-md overflow-x-auto text-sm">
                  <code>{cliCommand}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(cliCommand)}
                  title={isCopied ? "Copied!" : "Copy to clipboard"}
                >
                  <Icon name={isCopied ? "check" : "content_copy"} size={16} />
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Installation:</strong>
              </p>
              <pre className="bg-muted p-2 rounded-md text-xs">
                npm install -g @deco/cli
              </pre>
              <p className="mt-2">
                The CLI gives you access to advanced features like selective
                database schema export, custom output paths, and more.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsLinkModalOpen(false)}>Close</Button>
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
