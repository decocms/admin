import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useSearchParams, useParams } from "react-router";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { useHideLegacyFeatures } from "../../hooks/use-hide-legacy-features.ts";
import { usePrompts, useDeletePrompt } from "@deco/sdk";
import { isWellKnownPromptId } from "@deco/sdk/constants";
import { useThreadManager } from "../decopilot/thread-context-manager.tsx";
import {
  adaptPrompt,
  getPromptsColumns,
  getPromptRowActions,
} from "./documents-list-adapters.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { createPinAction } from "../common/pin-to-sidebar.tsx";
import { usePinnedTabs } from "../../hooks/use-pinned-tabs.ts";
import type { CustomRowAction } from "../resources-v2/list.tsx";
import type { ResourceListItem } from "../resources-v2/list.tsx";

/**
 * Documents resource list component that renders the ResourcesV2List
 * with the specific integration ID for documents management
 */
export function DocumentsResourceList({
  headerSlot,
}: {
  headerSlot?: ReactNode;
} = {}) {
  const [searchParams] = useSearchParams();
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();
  const { showLegacyFeature } = useHideLegacyFeatures();

  // State-based tab management instead of route-based
  const [activeTab, setActiveTab] = useState<"all" | "prompts">("all");

  // Automatically open Decopilot if openDecopilot query param is present
  useEffect(() => {
    const openDecopilot = searchParams.get("openDecopilot") === "true";
    if (openDecopilot) {
      setDecopilotOpen(true);
    }
  }, [searchParams, setDecopilotOpen]);

  // All hooks must be called unconditionally at the top level
  const { data: prompts } = usePrompts();
  const deletePrompt = useDeletePrompt();
  const { createTab } = useThreadManager();
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { org, project } = useParams();
  const projectKey = org && project ? `${org}/${project}` : undefined;
  const { togglePin, isPinned } = usePinnedTabs(projectKey);

  const tabs = useMemo(() => {
    const baseTabs = [
      {
        id: "all",
        label: "All",
        onClick: () => setActiveTab("all"),
      },
    ];

    if (showLegacyFeature("showLegacyPrompts")) {
      baseTabs.push({
        id: "prompts",
        label: "Prompts (Legacy)",
        onClick: () => setActiveTab("prompts"),
      });
    }

    return baseTabs;
  }, [showLegacyFeature]);

  // All hooks must be called unconditionally at the top level
  const filteredPrompts = useMemo(() => {
    if (activeTab !== "prompts") return [];
    return (
      prompts?.filter((prompt) => !isWellKnownPromptId(prompt.id)) ?? []
    ).map(adaptPrompt);
  }, [prompts, activeTab]);

  // Show legacy prompts if active tab is "prompts"
  if (activeTab === "prompts") {
    const handlePromptClick = (item: Record<string, unknown>) => {
      const prompt =
        (item._prompt as import("@deco/sdk").Prompt) ||
        (item as unknown as import("@deco/sdk").Prompt);

      console.log("[DocumentsResourceList] Prompt clicked", {
        promptId: prompt.id,
        promptName: prompt.name,
        hasContent: !!prompt.content,
        contentLength: prompt.content?.length || 0,
        activeTabId,
        item,
      });

      const resourceUri = `legacy-prompt://${prompt.id}`;
      console.log("[DocumentsResourceList] Opening prompt tab", {
        resourceUri,
        title: prompt.name || "Untitled",
      });

      const newTab = createTab({
        type: "detail",
        resourceUri,
        title: prompt.name || "Untitled",
        icon: "description",
      });
      if (!newTab) {
        console.warn("[PromptsListLegacy] No active tab found");
      }
    };

    const handleDelete = async () => {
      if (!promptToDelete) return;
      try {
        setDeleting(true);
        await deletePrompt.mutateAsync(promptToDelete);
      } catch (error) {
        console.error("Error deleting prompt:", error);
      } finally {
        setDeleting(false);
        setPromptToDelete(null);
      }
    };

    return (
      <>
        <ResourcesV2List
          integrationId="i:documents-management"
          resourceName="document"
          headerSlot={headerSlot}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as "all" | "prompts")}
          customData={filteredPrompts}
          customColumns={getPromptsColumns()}
          customRowActions={getPromptRowActions(
            (prompt) => setPromptToDelete(prompt.id),
            isPinned,
            togglePin,
          )}
          onItemClick={handlePromptClick}
          customCtaButton={null}
          customEmptyState={{
            icon: "local_library",
            title: "No documents yet",
            description: "Create a document to get started.",
          }}
        />
        <AlertDialog
          open={!!promptToDelete}
          onOpenChange={(open) => !open && setPromptToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the document. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {deleting ? (
                  <>
                    <Spinner />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Create default row actions for documents (pin action)
  const documentRowActions = useCallback(
    (item: ResourceListItem | Record<string, unknown>): CustomRowAction[] => {
      const resource = item as ResourceListItem;
      const itemRecord = item as Record<string, unknown>;

      // Get resource ID - could be in resource.id, resource.uri, or extracted from uri
      let resourceId = resource.id || (itemRecord.id as string);
      let resourceName =
        (resource.data?.name as string) ||
        ((itemRecord.data as Record<string, unknown>)?.name as string) ||
        "Untitled document";

      // If no ID but we have a URI, try to extract ID from URI
      // Format: rsc://i:documents-management/document/{id}
      if (!resourceId && resource.uri) {
        const uriMatch = resource.uri.match(/\/document\/([^/]+)/);
        if (uriMatch && uriMatch[1]) {
          resourceId = uriMatch[1];
        } else {
          // Use the full URI as ID if we can't extract
          resourceId = resource.uri;
        }
      }

      // If still no ID, use the URI as fallback
      if (!resourceId && resource.uri) {
        resourceId = resource.uri;
      }

      if (!resourceId) return [];

      return [
        createPinAction(
          resourceId,
          resourceName,
          "document",
          "i:documents-management",
          "description",
          isPinned,
          togglePin,
        ),
      ];
    },
    [isPinned, togglePin],
  );

  return (
    <ResourcesV2List
      integrationId="i:documents-management"
      resourceName="document"
      headerSlot={headerSlot}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as "all" | "prompts")}
      customRowActions={documentRowActions}
    />
  );
}

export default DocumentsResourceList;
