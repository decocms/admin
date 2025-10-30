export async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function truncateHash(hash: string, length = 8): string {
  if (!hash) return "";
  return `#${hash.slice(0, length)}`;
}

/**
 * Extract the actual tool name from a potentially namespaced tool name
 * Handles both "TOOL_NAME" and "integration_id__TOOL_NAME" formats
 */
function extractActualToolName(toolName: string | undefined | null): string {
  if (!toolName) return "";
  // Check if the name contains the double underscore separator
  const separatorIndex = toolName.lastIndexOf("__");
  if (separatorIndex === -1) {
    return toolName;
  }
  return toolName.substring(separatorIndex + 2);
}

export function isResourceUpdateTool(toolName: string | undefined | null) {
  const actualToolName = extractActualToolName(toolName);
  return /^DECO_RESOURCE_.*_UPDATE$/.test(actualToolName);
}

export function isResourceReadTool(toolName: string | undefined | null) {
  const actualToolName = extractActualToolName(toolName);
  return /^DECO_RESOURCE_.*_READ$/.test(actualToolName);
}

export function isResourceUpdateOrCreateTool(toolName: string | undefined | null) {
  const actualToolName = extractActualToolName(toolName);
  return /^DECO_RESOURCE_.*_(UPDATE|CREATE)$/.test(actualToolName);
}

// oxlint-disable-next-line no-explicit-any
export function extractResourceUriFromInput(input: any): string | null {
  if (input && typeof input === "object") {
    if (typeof input.uri === "string") return input.uri;
    if (typeof input.resource === "string") return input.resource;
  }
  return null;
}

// oxlint-disable-next-line no-explicit-any
export function extractUpdateDataFromInput(input: any): unknown {
  if (input && typeof input === "object" && "data" in input) {
    // oxlint-disable-next-line no-explicit-any
    return (input as any).data;
  }
  return input;
}

export function deriveUpdateToolFromRead(readToolName?: string | null) {
  if (!readToolName) return null;
  const actualToolName = extractActualToolName(readToolName);
  if (!/^DECO_RESOURCE_.*_READ$/.test(actualToolName)) return null;
  
  // If it was namespaced, preserve the namespace
  const separatorIndex = readToolName.lastIndexOf("__");
  if (separatorIndex !== -1) {
    const namespace = readToolName.substring(0, separatorIndex);
    return `${namespace}__${actualToolName.replace(/_READ$/, "_UPDATE")}`;
  }
  
  return readToolName.replace(/_READ$/, "_UPDATE");
}


