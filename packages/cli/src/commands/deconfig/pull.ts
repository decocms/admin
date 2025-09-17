import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "fs";
import { join, dirname, relative } from "path";
import process from "node:process";
import { fetchFileContent } from "./base.js";
import { walk } from "../../lib/fs.js";
import { createHash } from "crypto";

interface PullOptions {
  branchName: string;
  path: string;
  pathFilter?: string;
  workspace?: string;
  local?: boolean;
  dryRun?: boolean;
}

function getFileHash(filePath: string): string {
  try {
    const content = readFileSync(filePath);
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return "";
  }
}

export async function pullCommand(options: PullOptions): Promise<void> {
  const {
    branchName,
    path: localPath,
    pathFilter,
    workspace,
    local,
    dryRun,
  } = options;

  console.log(
    `📥 Pulling changes from branch "${branchName}" to "${localPath}"${dryRun ? " (dry run)" : ""}...`,
  );

  // Ensure local directory exists
  if (!existsSync(localPath)) {
    mkdirSync(localPath, { recursive: true });
    console.log(`📁 Created local directory: ${localPath}`);
  }

  // Get list of files from the remote branch
  const { createWorkspaceClient } = await import("../../lib/mcp.js");
  const client = await createWorkspaceClient({ workspace, local });

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
      files: Record<
        string,
        {
          address: string;
          metadata: Record<string, unknown>;
          mtime: number;
          ctime: number;
        }
      >;
      count: number;
    };

    console.log(`📋 Found ${result.count} remote files`);

    // Build a map of local files
    const localFiles = new Map<string, { hash: string; path: string }>();

    if (existsSync(localPath)) {
      for await (const entry of walk(localPath, {
        includeFiles: true,
        includeDirs: false,
        skip: [/node_modules/, /\.git/, /\.DS_Store/],
      })) {
        const relativePath = relative(localPath, entry.path);
        const remotePath = `/${relativePath.replace(/\\/g, "/")}`;
        const hash = getFileHash(entry.path);
        localFiles.set(remotePath, { hash, path: entry.path });
      }
    }

    // Analyze differences
    const toDownload: string[] = [];
    const toUpdate: string[] = [];
    const toDelete: string[] = [];

    // Check remote files against local files using remote blob hash
    for (const [remoteFilePath, remoteMeta] of Object.entries(result.files)) {
      if (pathFilter && !remoteFilePath.startsWith(pathFilter)) {
        continue;
      }

      const localFile = localFiles.get(remoteFilePath);
      if (!localFile) {
        toDownload.push(remoteFilePath);
      } else {
        const parts = (remoteMeta.address || "").split(":");
        const remoteHash = parts.length >= 3 ? parts[2] : "";
        if (!remoteHash || localFile.hash !== remoteHash) {
          toUpdate.push(remoteFilePath);
        }

        // Remove from local files map (files remaining will be deleted)
        localFiles.delete(remoteFilePath);
      }
    }

    // Remaining local files should be deleted
    for (const [remoteFilePath] of localFiles) {
      if (!pathFilter || remoteFilePath.startsWith(pathFilter)) {
        toDelete.push(remoteFilePath);
      }
    }

    console.log(
      `📊 Changes: ${toDownload.length} new, ${toUpdate.length} modified, ${toDelete.length} to delete`,
    );

    if (dryRun) {
      if (toDownload.length > 0) {
        console.log("\n📥 Files to download:");
        toDownload.forEach((path) => console.log(`   + ${path}`));
      }
      if (toUpdate.length > 0) {
        console.log("\n📝 Files to update:");
        toUpdate.forEach((path) => console.log(`   ~ ${path}`));
      }
      if (toDelete.length > 0) {
        console.log("\n🗑️  Files to delete:");
        toDelete.forEach((path) => console.log(`   - ${path}`));
      }
      console.log(
        `\n✅ Dry run completed. ${toDownload.length + toUpdate.length + toDelete.length} changes detected.`,
      );
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Download new files
    for (const filePath of toDownload) {
      try {
        console.log(`📥 Downloading: ${filePath}`);

        const content = await fetchFileContent(
          filePath,
          branchName,
          workspace,
          local,
        );
        const localFilePath = join(
          localPath,
          filePath.startsWith("/") ? filePath.slice(1) : filePath,
        );

        const dir = dirname(localFilePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        writeFileSync(localFilePath, content);
        console.log(
          `   ✅ Downloaded: ${localFilePath} (${content.length} bytes)`,
        );
        successCount++;
      } catch (error) {
        console.error(
          `   ❌ Failed to download ${filePath}:`,
          error instanceof Error ? error.message : String(error),
        );
        errorCount++;
      }
    }

    // Update modified files
    for (const filePath of toUpdate) {
      try {
        console.log(`📝 Updating: ${filePath}`);

        const content = await fetchFileContent(
          filePath,
          branchName,
          workspace,
          local,
        );
        const localFilePath = join(
          localPath,
          filePath.startsWith("/") ? filePath.slice(1) : filePath,
        );

        writeFileSync(localFilePath, content);
        console.log(
          `   ✅ Updated: ${localFilePath} (${content.length} bytes)`,
        );
        successCount++;
      } catch (error) {
        console.error(
          `   ❌ Failed to update ${filePath}:`,
          error instanceof Error ? error.message : String(error),
        );
        errorCount++;
      }
    }

    // Delete removed files
    for (const filePath of toDelete) {
      const localFile = localFiles.get(filePath);
      if (localFile) {
        try {
          console.log(`🗑️  Deleting: ${filePath}`);
          unlinkSync(localFile.path);
          console.log(`   ✅ Deleted: ${localFile.path}`);
          successCount++;
        } catch (error) {
          console.error(
            `   ❌ Failed to delete ${filePath}:`,
            error instanceof Error ? error.message : String(error),
          );
          errorCount++;
        }
      }
    }

    if (errorCount > 0) {
      console.log(
        `\n⚠️  Pull completed with errors: ${successCount} succeeded, ${errorCount} failed`,
      );
    } else {
      console.log(
        `\n🎉 Pull completed successfully! Applied ${successCount} changes from ${branchName}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Session not found") ||
      errorMessage.includes("Session expired")
    ) {
      console.error("💥 Pull failed: Authentication required");
      console.error(
        "   Please run 'deco login' first to authenticate with deco.chat",
      );
    } else {
      console.error("💥 Pull failed:", errorMessage);
    }

    process.exit(1);
  } finally {
    // Always close the client connection
    await client.close();
  }
}
