import { DocumentsResourceList } from "./documents-resource-list.tsx";

/**
 * Legacy route handler for /documents/prompts
 * Renders the DocumentsResourceList which now handles tabs in place
 */
export default function PromptsLegacyPage() {
  // This route is kept for backwards compatibility with bookmarks/direct links
  // The actual tab switching is now handled in DocumentsResourceList via state
  return <DocumentsResourceList />;
}
