import { readFileSync, statSync } from "fs";
import { relative } from "path";
import { putFileContent } from "./base.js";
import { walk } from "../../lib/fs.js";
import process from "node:process";

interface PushOptions {
  branchName: string;
  path: string;
  pathFilter?: string;
  workspace?: string;
  local?: boolean;
  dryRun?: boolean;
}

export async function pushCommand(options: PushOptions): Promise<void> {
  const {
    branchName,
    path: localPath,
    pathFilter,
    workspace,
    local,
    dryRun,
  } = options;

  console.log(
    `📤 Pushing files from "${localPath}" to branch "${branchName}"${
      dryRun ? " (dry run)" : ""
    }...`,
  );

  try {
    // Check if local path exists
    const pathStats = statSync(localPath);
    if (!pathStats.isDirectory()) {
      throw new Error(`Path is not a directory: ${localPath}`);
    }

    // Walk through local files
    const filesToPush: Array<{
      localPath: string;
      remotePath: string;
      size: number;
    }> = [];

    for await (const entry of walk(localPath, {
      includeFiles: true,
      includeDirs: false,
      skip: [/node_modules/, /\.git/, /\.DS_Store/],
    })) {
      const relativePath = relative(localPath, entry.path);
      const remotePath = `/${relativePath.replace(/\\/g, "/")}`;

      // Apply path filter if specified
      if (pathFilter && !remotePath.startsWith(pathFilter)) {
        continue;
      }

      const stats = statSync(entry.path);
      filesToPush.push({
        localPath: entry.path,
        remotePath,
        size: stats.size,
      });
    }

    console.log(`📋 Found ${filesToPush.length} files to push`);

    if (dryRun) {
      console.log("\n📝 Files that would be pushed:");
      for (const file of filesToPush) {
        console.log(`   ${file.remotePath} (${file.size} bytes)`);
      }
      console.log(
        `\n✅ Dry run completed. ${filesToPush.length} files would be pushed.`,
      );
      return;
    }

    // Push each file
    let successCount = 0;
    let errorCount = 0;

    for (const file of filesToPush) {
      try {
        console.log(`📤 Pushing: ${file.remotePath}`);

        // Read file content
        const content = readFileSync(file.localPath);

        // Push to remote branch
        await putFileContent(
          file.remotePath,
          content,
          branchName,
          undefined, // no metadata for now
          workspace,
          local,
        );

        console.log(`   ✅ Pushed: ${file.remotePath} (${file.size} bytes)`);
        successCount++;
      } catch (error) {
        console.error(
          `   ❌ Failed to push ${file.remotePath}:`,
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
    } else {
      console.log(
        `\n🎉 Push completed successfully! Pushed ${successCount} files to ${branchName}`,
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
