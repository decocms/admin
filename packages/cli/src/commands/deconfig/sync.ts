import { readFileSync, statSync, watch } from "fs";
import process from "node:process";
import { join, relative } from "path";
import { createIgnoreChecker } from "../../lib/ignore.js";
import { putFileContent } from "./base.js";

interface SyncOptions {
  localPath: string;
  branchName: string;
  pathFilter?: string;
  workspace?: string;
  local?: boolean;
}

/**
 * Push a single file to the remote branch without checking remote state first
 */
async function pushSingleFile(
  localFilePath: string,
  remotePath: string,
  branchName: string,
  workspace?: string,
  local?: boolean,
): Promise<void> {
  try {
    const stats = statSync(localFilePath);

    console.log(`📤 Pushing: ${remotePath} (${stats.size} bytes)`);

    // Read file content and upload directly
    const content = readFileSync(localFilePath);
    await putFileContent(
      remotePath,
      content,
      branchName,
      undefined, // no metadata for now
      workspace,
      local,
    );

    console.log(`   ✅ Pushed: ${remotePath}`);
  } catch (error) {
    console.error(
      `   ❌ Failed to push ${remotePath}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Watch directory for changes and automatically push modified files
 */
export async function watchAndSync(options: SyncOptions): Promise<void> {
  const { localPath, branchName, pathFilter, workspace, local } = options;

  console.log(`👀 Watching directory "${localPath}" for changes...`);
  console.log("   Press Ctrl+C to stop watching");

  // Create ignore checker for .deconfigignore patterns
  const ignoreChecker = createIgnoreChecker(localPath);
  console.log(`📋 Loaded ${ignoreChecker.getPatternCount()} ignore patterns`);

  // Debounce map to avoid multiple rapid changes to the same file
  const debounceMap = new Map<string, NodeJS.Timeout>();
  const DEBOUNCE_DELAY = 500; // 500ms delay

  try {
    // Watch the directory recursively
    const watcher = watch(localPath, { recursive: true }, (_, filename) => {
      if (!filename) return;

      const fullPath = join(localPath, filename);
      const relativePath = relative(localPath, fullPath);
      const remotePath = `/${relativePath.replace(/\\/g, "/")}`;

      // Apply path filter if specified
      if (pathFilter && !remotePath.startsWith(pathFilter)) {
        return;
      }

      // Check if file should be ignored
      if (ignoreChecker.isIgnored(fullPath)) {
        return;
      }

      // Check if file exists and is a regular file
      try {
        const stats = statSync(fullPath);
        if (!stats.isFile()) {
          return;
        }
      } catch {
        // File might have been deleted or is not accessible
        return;
      }

      // Clear existing timeout for this file
      const existingTimeout = debounceMap.get(fullPath);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new debounced upload
      const timeout = setTimeout(async () => {
        console.log(`🔄 File changed: ${remotePath}`);
        await pushSingleFile(
          fullPath,
          remotePath,
          branchName,
          workspace,
          local,
        );
        debounceMap.delete(fullPath);
      }, DEBOUNCE_DELAY);

      debounceMap.set(fullPath, timeout);
    });

    // Handle graceful shutdown
    const cleanup = () => {
      console.log("\n🛑 Stopping file watcher...");
      watcher.close();

      // Clear any pending timeouts
      for (const timeout of debounceMap.values()) {
        clearTimeout(timeout);
      }

      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Keep the process alive
    await new Promise(() => {}); // Never resolves
  } catch (error) {
    console.error(
      "❌ Watch failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
