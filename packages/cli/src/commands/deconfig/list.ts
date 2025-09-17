import inquirer from "inquirer";
import { fetchFileContent } from "./base.js";
import process from "node:process";

interface ListOptions {
  branchName: string;
  pathFilter?: string;
  workspace?: string;
  local?: boolean;
  format?: "plainString" | "json" | "base64";
}

interface FileInfo {
  address: string;
  metadata: Record<string, unknown>;
  sizeInBytes: number;
  mtime: number;
  ctime: number;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const {
    branchName,
    pathFilter,
    workspace,
    local,
    format = "plainString",
  } = options;

  console.log(`📋 Listing files in branch "${branchName}"...`);
  if (pathFilter) {
    console.log(`   🔍 Path filter: ${pathFilter}`);
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
      files: Record<string, FileInfo>;
      count: number;
    };

    if (result.count === 0) {
      console.log("📂 No files found in this branch.");
      return;
    }

    console.log(`📋 Found ${result.count} files`);

    // Prepare file choices for interactive selection
    const fileChoices = Object.entries(result.files).map(([path, info]) => {
      const size = formatFileSize(info.sizeInBytes);
      const lastModified = new Date(info.mtime).toLocaleString();
      return {
        name: `${path} (${size}, modified: ${lastModified})`,
        value: path,
        short: path,
      };
    });

    // Add option to exit
    fileChoices.push({
      name: "🚪 Exit",
      value: "__EXIT__",
      short: "Exit",
    });

    while (true) {
      // Interactive file selection
      const { selectedFile } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedFile",
          message: "Select a file to view its content:",
          choices: fileChoices,
          pageSize: 15,
        },
      ]);

      if (selectedFile === "__EXIT__") {
        console.log("👋 Goodbye!");
        break;
      }

      // Display file content
      try {
        console.log(`\n📄 Loading content for: ${selectedFile}`);

        const content = await fetchFileContent(
          selectedFile,
          branchName,
          workspace,
          local,
        );

        const fileInfo = result.files[selectedFile];

        console.log(`\n${"=".repeat(60)}`);
        console.log(`📁 File: ${selectedFile}`);
        console.log(`📊 Size: ${formatFileSize(fileInfo.sizeInBytes)}`);
        console.log(
          `⏰ Modified: ${new Date(fileInfo.mtime).toLocaleString()}`,
        );
        console.log(`🏷️  Address: ${fileInfo.address}`);
        if (Object.keys(fileInfo.metadata).length > 0) {
          console.log(
            `📋 Metadata: ${JSON.stringify(fileInfo.metadata, null, 2)}`,
          );
        }
        console.log(`${"=".repeat(60)}\n`);

        // Display content based on format
        let displayContent: string;

        switch (format) {
          case "json":
            try {
              const text = content.toString("utf-8");
              const parsed = JSON.parse(text);
              displayContent = JSON.stringify(parsed, null, 2);
            } catch {
              displayContent = content.toString("utf-8");
            }
            break;
          case "base64":
            displayContent = content.toString("base64");
            break;
          case "plainString":
          default:
            displayContent = content.toString("utf-8");
            break;
        }

        // For large files, show a preview with option to see more
        const lines = displayContent.split("\n");
        const maxPreviewLines = 50;

        if (lines.length > maxPreviewLines) {
          console.log(lines.slice(0, maxPreviewLines).join("\n"));
          console.log(`\n... (${lines.length - maxPreviewLines} more lines)`);

          const { showMore } = await inquirer.prompt([
            {
              type: "confirm",
              name: "showMore",
              message: "Show the complete file content?",
              default: false,
            },
          ]);

          if (showMore) {
            console.log(`\n${"=".repeat(60)}`);
            console.log("📄 Complete file content:");
            console.log(`${"=".repeat(60)}\n`);
            console.log(displayContent);
          }
        } else {
          console.log(displayContent);
        }

        console.log(`\n${"=".repeat(60)}\n`);

        // Ask if user wants to continue browsing
        const { continueReading } = await inquirer.prompt([
          {
            type: "confirm",
            name: "continueReading",
            message: "Continue browsing files?",
            default: true,
          },
        ]);

        if (!continueReading) {
          console.log("👋 Goodbye!");
          break;
        }
      } catch (error) {
        console.error(
          `❌ Failed to read file ${selectedFile}:`,
          error instanceof Error ? error.message : String(error),
        );

        const { tryAgain } = await inquirer.prompt([
          {
            type: "confirm",
            name: "tryAgain",
            message: "Continue browsing other files?",
            default: true,
          },
        ]);

        if (!tryAgain) {
          break;
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Session not found") ||
      errorMessage.includes("Session expired")
    ) {
      console.error("💥 List failed: Authentication required");
      console.error(
        "   Please run 'deco login' first to authenticate with deco.chat",
      );
    } else {
      console.error("💥 List failed:", errorMessage);
    }

    process.exit(1);
  } finally {
    // Always close the client connection
    await client.close();
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
