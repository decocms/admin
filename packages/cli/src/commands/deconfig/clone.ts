import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import process from "node:process";
import { fetchFileContent } from "./base.js";

interface CloneOptions {
  branchName: string;
  path: string;
  pathFilter?: string;
  workspace?: string;
  local?: boolean;
}

export async function cloneCommand(options: CloneOptions): Promise<void> {
  const { branchName, path: localPath, pathFilter, workspace, local } = options;

  console.log(`📥 Cloning branch "${branchName}" to local path: ${localPath}`);

  // Ensure local directory exists
  if (!existsSync(localPath)) {
    mkdirSync(localPath, { recursive: true });
    console.log(`📁 Created local directory: ${localPath}`);
  }

  // Get list of files from the branch
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

    console.log(`📋 Found ${result.count} files to clone`);

    // Download each file
    for (const [filePath] of Object.entries(result.files)) {
      const localFilePath = join(
        localPath,
        filePath.startsWith("/") ? filePath.slice(1) : filePath,
      );

      try {
        console.log(`📥 Downloading: ${filePath}`);

        // Fetch file content
        const content = await fetchFileContent(
          filePath,
          branchName,
          workspace,
          local,
        );

        // Ensure directory exists
        const dir = dirname(localFilePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        // Write to local filesystem
        writeFileSync(localFilePath, content);

        console.log(
          `   ✅ Cloned to: ${localFilePath} (${content.length} bytes)`,
        );
      } catch (error) {
        console.error(
          `   ❌ Failed to clone ${filePath}:`,
          error instanceof Error ? error.message : String(error),
        );
        // Continue with other files
      }
    }

    console.log(
      `🎉 Clone completed! Downloaded ${result.count} files to ${localPath}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Session not found") ||
      errorMessage.includes("Session expired")
    ) {
      console.error("💥 Clone failed: Authentication required");
      console.error(
        "   Please run 'deco login' first to authenticate with deco.chat",
      );
    } else {
      console.error("💥 Clone failed:", errorMessage);
    }

    process.exit(1);
  } finally {
    // Always close the client connection
    await client.close();
  }
}
