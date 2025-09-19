/**
 * DECONFIG Push Command - Rsync-like file synchronization
 *
 * This command implements rsync-like behavior for pushing local files to a remote DECONFIG branch:
 *
 * 1. **Hash-based comparison**: Uses SHA-256 hashes (same as blobs.ts) to detect content changes
 * 2. **Efficient uploads**: Only transfers new or modified files
 * 3. **Smart filtering**: Uses .deconfigignore files (gitignore-style patterns) plus built-in patterns
 * 4. **Watch mode**: Monitors directory for changes and automatically pushes modified files
 *
 * Hash extraction from blob addresses:
 * - Remote files have addresses like "blobs:project-blob:abc123..."
 * - We extract the hash (3rd part after splitting by ':')
 * - Compare with local file SHA-256 hash using the same algorithm as blobs.ts
 *
 * Note: Deletion detection is not yet implemented - files deleted locally
 * will remain on the remote branch until manually deleted.
 */

import { readFileSync, statSync } from "fs";
import { relative, join } from "path";
import { createHash } from "crypto";
import { putFileContent } from "./base.js";
import { walk } from "../../lib/fs.js";
import { createWorkspaceClient } from "../../lib/mcp.js";
import { createIgnoreChecker } from "../../lib/ignore.js";
import { watchAndSync } from "./sync.js";
import process from "node:process";

interface PushOptions {
  branchName: string;
  path: string;
  pathFilter?: string;
  workspace?: string;
  local?: boolean;
  dryRun?: boolean;
  watch?: boolean;
}

interface LocalFileInfo {
  hash: string;
  size: number;
}

interface RemoteFileInfo {
  address: string;
  metadata: Record<string, unknown>;
  sizeInBytes: number;
  mtime: number;
  ctime: number;
}

/**
 * Calculate SHA-256 hash of file content (same as blobs.ts)
 */
function calculateFileHash(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Extract hash from blob address format: "blobs:blob-id:hash"
 */
function extractHashFromAddress(address: string): string {
  const parts = address.split(":");
  return parts.length >= 3 ? parts[2] : "";
}

export async function pushCommand(options: PushOptions): Promise<void> {
  const {
    branchName,
    path: localPath,
    pathFilter,
    workspace,
    local,
    dryRun,
    watch: watchMode,
  } = options;

  console.log(
    `📤 ${watchMode ? "Watching and pushing" : "Pushing"} files from "${localPath}" to branch "${branchName}"${
      dryRun ? " (dry run)" : ""
    }...`,
  );

  try {
    // Check if local path exists
    const pathStats = statSync(localPath);
    if (!pathStats.isDirectory()) {
      throw new Error(`Path is not a directory: ${localPath}`);
    }

    // Create ignore checker for .deconfigignore patterns
    const ignoreChecker = createIgnoreChecker(localPath);
    console.log(`📋 Loaded ${ignoreChecker.getPatternCount()} ignore patterns`);

    // If watch mode is enabled, start watching
    if (watchMode) {
      if (dryRun) {
        console.error("❌ Cannot use --watch with --dry-run");
        process.exit(1);
      }

      // Do initial push first
      console.log("🚀 Performing initial push...");
      await pushCommand({
        ...options,
        watch: false, // Disable watch for initial push
      });

      console.log("✅ Initial push completed, starting watch mode...\n");

      // Start watching for changes using the sync module
      await watchAndSync({
        localPath,
        branchName,
        pathFilter,
        workspace,
        local,
      });
      return;
    }

    // Get current local files
    const currentLocalFiles = new Map<string, LocalFileInfo>();

    for await (const entry of walk(localPath, {
      includeFiles: true,
      includeDirs: false,
      skip: ignoreChecker.toWalkSkipPatterns(),
    })) {
      const relativePath = relative(localPath, entry.path);
      const remotePath = `/${relativePath.replace(/\\/g, "/")}`;

      // Apply path filter if specified
      if (pathFilter && !remotePath.startsWith(pathFilter)) {
        continue;
      }

      const stats = statSync(entry.path);
      const hash = calculateFileHash(entry.path);

      currentLocalFiles.set(remotePath, {
        hash,
        size: stats.size,
      });
    }

    // Get remote files list
    const client = await createWorkspaceClient({ workspace, local });

    let remoteFiles: Record<string, RemoteFileInfo> = {};

    try {
      const response = await client.callTool({
        name: "LIST_FILES",
        arguments: {
          branch: branchName,
          prefix: pathFilter,
        },
      });

      if (response.isError) {
        const errorMessage = Array.isArray(response.content)
          ? response.content[0]?.text || "Failed to list files"
          : "Failed to list files";
        throw new Error(errorMessage);
      }

      const result = response.structuredContent as {
        files: Record<string, RemoteFileInfo>;
        count: number;
      };

      remoteFiles = result.files;
      console.log(`📋 Found ${result.count} remote files`);
    } finally {
      await client.close();
    }

    // Analyze changes
    const toUpload: string[] = [];
    const toUpdate: string[] = [];

    // Check for new/modified files
    for (const [remotePath, localInfo] of currentLocalFiles) {
      const remoteInfo = remoteFiles[remotePath];

      if (!remoteInfo) {
        // File doesn't exist remotely
        toUpload.push(remotePath);
      } else {
        // File exists remotely, check if content changed
        const remoteHash = extractHashFromAddress(remoteInfo.address);
        if (localInfo.hash !== remoteHash) {
          toUpdate.push(remotePath);
        }
      }
    }

    console.log(
      `📊 Changes detected: ${toUpload.length} new, ${toUpdate.length} modified`,
    );

    if (dryRun) {
      if (toUpload.length > 0) {
        console.log("\n📤 Files to upload:");
        for (const path of toUpload) {
          const info = currentLocalFiles.get(path)!;
          console.log(`   + ${path} (${info.size} bytes)`);
        }
      }
      if (toUpdate.length > 0) {
        console.log("\n📝 Files to update:");
        for (const path of toUpdate) {
          const info = currentLocalFiles.get(path)!;
          console.log(`   ~ ${path} (${info.size} bytes)`);
        }
      }
      console.log(
        `\n✅ Dry run completed. ${toUpload.length + toUpdate.length} changes detected.`,
      );
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const totalOperations = toUpload.length + toUpdate.length;

    if (totalOperations === 0) {
      console.log("✅ No changes detected. Branch is up to date!");
      return;
    }

    // Process uploads and updates
    for (const remotePath of [...toUpload, ...toUpdate]) {
      try {
        const isUpdate = toUpdate.includes(remotePath);
        const localInfo = currentLocalFiles.get(remotePath)!;
        const localFilePath = join(localPath, remotePath.substring(1)); // Remove leading '/'

        console.log(
          `📤 ${isUpdate ? "Updating" : "Uploading"}: ${remotePath} (${localInfo.size} bytes)`,
        );

        // Read file content
        const content = readFileSync(localFilePath);

        // Push to remote branch
        await putFileContent(
          remotePath,
          content,
          branchName,
          undefined, // no metadata for now
          workspace,
          local,
        );

        console.log(
          `   ✅ ${isUpdate ? "Updated" : "Uploaded"}: ${remotePath}`,
        );
        successCount++;
      } catch (error) {
        console.error(
          `   ❌ Failed to ${toUpdate.includes(remotePath) ? "update" : "upload"} ${remotePath}:`,
          error instanceof Error ? error.message : String(error),
        );
        errorCount++;
        // Continue with other files
      }
    }

    if (errorCount > 0) {
      console.log(
        `\n⚠️  Push completed with errors: ${successCount} succeeded, ${errorCount} failed`,
      );
      process.exit(1);
    } else {
      console.log(
        `\n🎉 Push completed successfully! ${successCount} operations completed on ${branchName}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Session not found") ||
      errorMessage.includes("Session expired")
    ) {
      console.error("💥 Push failed: Authentication required");
      console.error(
        "   Please run 'deco login' first to authenticate with deco.chat",
      );
    } else {
      console.error("💥 Push failed:", errorMessage);
    }

    process.exit(1);
  }
}
