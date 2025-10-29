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

export function isResourceUpdateTool(toolName: string | undefined | null) {
  return /^DECO_RESOURCE_.*_UPDATE$/.test(toolName ?? "");
}

export function isResourceReadTool(toolName: string | undefined | null) {
  return /^DECO_RESOURCE_.*_READ$/.test(toolName ?? "");
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
  if (!/^DECO_RESOURCE_.*_READ$/.test(readToolName)) return null;
  return readToolName.replace(/_READ$/, "_UPDATE");
}


