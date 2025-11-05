/**
 * Helpers for reading, writing, and validating MCP project manifests
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  type Manifest,
  parseManifest,
  createManifest,
  type ManifestProject,
  type ManifestAuthor,
  type ManifestResources,
  type ManifestDependencies,
} from "./manifest-schema.js";

const MANIFEST_FILENAME = "deco.mcp.json";

/**
 * Read and parse a manifest file from disk
 */
export async function readManifestFile(dirPath: string): Promise<Manifest> {
  const manifestPath = path.join(dirPath, MANIFEST_FILENAME);
  const content = await fs.readFile(manifestPath, "utf-8");
  const data = JSON.parse(content);
  return parseManifest(data);
}

/**
 * Write a manifest file to disk
 */
export async function writeManifestFile(
  dirPath: string,
  manifest: Manifest,
): Promise<void> {
  const manifestPath = path.join(dirPath, MANIFEST_FILENAME);
  await fs.writeFile(
    manifestPath,
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8",
  );
}

/**
 * Check if a manifest file exists in a directory
 */
export async function manifestExists(dirPath: string): Promise<boolean> {
  const manifestPath = path.join(dirPath, MANIFEST_FILENAME);
  try {
    await fs.access(manifestPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a manifest from components
 */
export function buildManifest(
  project: ManifestProject,
  author: ManifestAuthor,
  resources: ManifestResources,
  dependencies: ManifestDependencies,
): Manifest {
  return createManifest(project, author, resources, dependencies);
}

/**
 * Extract MCP dependencies from tool JSON files
 * Best-effort: parse each tool file and collect referenced integration IDs
 */
export async function extractDependenciesFromTools(
  toolFiles: Array<{ path: string; content: string }>,
): Promise<string[]> {
  const integrationIds = new Set<string>();

  for (const file of toolFiles) {
    try {
      const tool = JSON.parse(file.content);

      // Look for integration_id field (common pattern)
      if (tool.integration_id && typeof tool.integration_id === "string") {
        integrationIds.add(tool.integration_id);
      }

      // Look for integrationId field (alternate pattern)
      if (tool.integrationId && typeof tool.integrationId === "string") {
        integrationIds.add(tool.integrationId);
      }

      // Look for tools_set references (object keys)
      if (tool.tools_set && typeof tool.tools_set === "object") {
        for (const key of Object.keys(tool.tools_set)) {
          if (key.startsWith("i:")) {
            integrationIds.add(key);
          }
        }
      }
    } catch (err) {
      // Skip malformed JSON files
      console.warn(`Warning: Could not parse tool file ${file.path}: ${err}`);
    }
  }

  return Array.from(integrationIds).sort();
}

/**
 * Get the manifest filename
 */
export function getManifestFilename(): string {
  return MANIFEST_FILENAME;
}
