import { existsSync, promises as fs, mkdirSync } from "fs";
import process from "node:process";
import { join } from "path";

export interface DeconfigHead {
  workspace: string;
  branch: string;
  path?: string;
  pathFilter?: string;
  local?: boolean;
}

const DECONFIG_DIR = ".deconfig";
const HEAD_FILE = "head";

/**
 * Get the path to the .deconfig/head file
 * @param cwd - The current working directory (defaults to process.cwd())
 * @returns The full path to the .deconfig/head file
 */
function getDeconfigHeadPath(cwd?: string): string {
  const targetCwd = cwd || process.cwd();
  return join(targetCwd, DECONFIG_DIR, HEAD_FILE);
}

/**
 * Get the path to the .deconfig directory
 * @param cwd - The current working directory (defaults to process.cwd())
 * @returns The full path to the .deconfig directory
 */
function getDeconfigDir(cwd?: string): string {
  const targetCwd = cwd || process.cwd();
  return join(targetCwd, DECONFIG_DIR);
}

/**
 * Ensure the .deconfig directory exists
 * @param cwd - The current working directory (defaults to process.cwd())
 */
function ensureDeconfigDir(cwd?: string): void {
  const deconfigDir = getDeconfigDir(cwd);
  if (!existsSync(deconfigDir)) {
    mkdirSync(deconfigDir, { recursive: true });
  }
}

/**
 * Read the deconfig HEAD file
 * @param cwd - The current working directory (defaults to process.cwd())
 * @returns The deconfig HEAD configuration or null if the file doesn't exist
 */
export async function readDeconfigHead(
  cwd?: string,
): Promise<DeconfigHead | null> {
  const headPath = getDeconfigHeadPath(cwd);

  try {
    const content = await fs.readFile(headPath, "utf-8");
    const config = JSON.parse(content) as DeconfigHead;
    return config;
  } catch (error) {
    // File doesn't exist or is invalid JSON
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    console.warn(
      `Warning: Could not read .deconfig/head file: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

/**
 * Write the deconfig HEAD file
 * @param config - The deconfig HEAD configuration to write
 * @param cwd - The current working directory (defaults to process.cwd())
 */
export async function writeDeconfigHead(
  config: DeconfigHead,
  cwd?: string,
): Promise<void> {
  ensureDeconfigDir(cwd);
  const headPath = getDeconfigHeadPath(cwd);

  try {
    // Write config as formatted JSON
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(headPath, content, "utf-8");
  } catch (error) {
    console.error(
      `❌ Failed to write .deconfig/head file: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    throw error;
  }
}

/**
 * Check if a deconfig HEAD file exists
 * @param cwd - The current working directory (defaults to process.cwd())
 * @returns True if the HEAD file exists, false otherwise
 */
function hasDeconfigHead(cwd?: string): boolean {
  const headPath = getDeconfigHeadPath(cwd);
  return existsSync(headPath);
}
