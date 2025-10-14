export const formatFilename = (filename: string) => {
  return (
    filename
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-") // spaces and underscores to hyphens
      .replace(/[^a-z0-9.-]/g, "") // remove non-alphanumeric except dots and hyphens
      .replace(/-+/g, "-") // multiple hyphens to single
      .replace(/^-+|-+$/g, "") || // trim hyphens
    "untitled"
  );
};

/**
 * Formats a resource name from SCREAMING_SNAKE_CASE to Title Case
 * @example formatResourceName("WORKFLOW_RUN") // "Workflow Run"
 * @example formatResourceName("DOCUMENT") // "Document"
 */
export function formatResourceName(resourceName: string): string {
  return resourceName
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
