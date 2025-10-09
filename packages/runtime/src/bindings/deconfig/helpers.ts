// Helper functions for DeconfigResource

export const normalizeDirectory = (dir: string) => {
  // Ensure directory starts with / and doesn't end with /
  const normalized = dir.startsWith("/") ? dir : `/${dir}`;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
};

export const buildFilePath = (directory: string, resourceId: string) => {
  const normalizedDir = normalizeDirectory(directory);
  return `${normalizedDir}/${resourceId}.json`;
};

export const extractResourceId = (uri: string) => {
  // Extract ID from Resources 2.0 URI format: rsc://integrationId/resourceName/resource-id
  const match = uri.match(/^rsc:\/\/[^\/]+\/[^\/]+\/(.+)$/);
  if (!match) {
    throw new Error("Invalid Resources 2.0 URI format");
  }
  return match[1];
};

export const constructResourceUri = (
  integrationId: string,
  resourceName: string,
  resourceId: string,
) => {
  return `rsc://${integrationId}/${resourceName}/${resourceId}`;
};

export function getMetadataValue(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== "object") return undefined;
  const metaObj = metadata as Record<string, unknown>;
  if (key in metaObj) return metaObj[key];
  const nested = metaObj.metadata;
  if (nested && typeof nested === "object" && key in nested) {
    return (nested as Record<string, unknown>)[key];
  }
  return undefined;
}

export function getMetadataString(
  metadata: unknown,
  key: string,
): string | undefined {
  const value = getMetadataValue(metadata, key);
  return typeof value === "string" ? value : undefined;
}
