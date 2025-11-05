/**
 * Import a project from a local directory
 */
import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import inquirer from "inquirer";
import { promptWorkspace } from "../../lib/prompt-workspace.js";
import { createWorkspaceClient } from "../../lib/mcp.js";
import { putFileContent } from "../deconfig/base.js";
import { readManifestFile, manifestExists } from "../../lib/mcp-manifest.js";
import { createIgnoreChecker } from "../../lib/ignore.js";
import { sanitizeProjectPath } from "@deco/sdk/mcp/projects/file-utils";

interface ImportOptions {
  from?: string;
  org?: string;
  slug?: string;
  title?: string;
  local?: boolean;
}

// Local directory structure (no src/ prefix)
const ALLOWED_ROOTS = ["/tools", "/views", "/workflows", "/documents"];
const AGENTS_DIR = "agents";

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0 || limit <= 0) {
    return;
  }

  let nextIndex = 0;
  const size = Math.min(limit, items.length);

  const runners = Array.from({ length: size }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
}

// Map local paths to remote Deconfig paths (add /src/ prefix)
const mapToRemotePath = (localPath: string): string => {
  // If path starts with one of our allowed roots, prefix with /src
  for (const root of ALLOWED_ROOTS) {
    if (localPath.startsWith(root)) {
      return `/src${localPath}`;
    }
  }
  return localPath;
};

export async function importCommand(options: ImportOptions): Promise<void> {
  const { local } = options;

  console.log("📦 Starting project import...\n");

  // Step 1: Determine source directory
  let fromDir = options.from || "./";
  fromDir = path.resolve(fromDir);
  if (!existsSync(fromDir)) {
    throw new Error(`Source directory '${fromDir}' does not exist`);
  }

  // Step 2: Read and validate manifest
  console.log(`📋 Reading manifest from ${fromDir}...`);
  if (!(await manifestExists(fromDir))) {
    throw new Error(
      `Manifest file 'deco.mcp.json' not found in '${fromDir}'. This directory is not a valid MCP project.`,
    );
  }

  const manifest = await readManifestFile(fromDir);
  console.log(
    `   ✅ Manifest validated (schema version ${manifest.schemaVersion})\n`,
  );

  // Step 3: Derive project metadata (with overrides)
  let projectSlug = options.slug || manifest.project.slug; // Use 'let' to allow updating on collision
  const projectTitle = options.title || manifest.project.title;
  const projectDescription = manifest.project.description;

  console.log("📍 Project to import:");
  console.log(`   Slug: ${projectSlug}`);
  console.log(`   Title: ${projectTitle}`);
  if (projectDescription) {
    console.log(`   Description: ${projectDescription}`);
  }
  console.log();

  // Step 4: Select destination org
  let orgSlug = options.org;
  if (!orgSlug) {
    orgSlug = await promptWorkspace(local);
  }
  console.log(`📍 Destination organization: ${orgSlug}\n`);

  // Step 5: Create project (use empty workspace for global tools)
  console.log(`🔨 Creating project '${projectSlug}'...`);
  let client = await createWorkspaceClient({ workspace: "", local });

  let projectId: string;
  try {
    const createResponse = await client.callTool({
      name: "PROJECTS_CREATE",
      arguments: {
        org: orgSlug,
        slug: projectSlug,
        title: projectTitle,
        description: projectDescription,
      },
    });

    if (createResponse.isError) {
      const errorMsg = Array.isArray(createResponse.content)
        ? createResponse.content[0]?.text || "Failed to create project"
        : String(createResponse.content);

      // Handle slug collision
      if (
        errorMsg.includes("already exists") ||
        errorMsg.includes("duplicate")
      ) {
        console.error(
          `   ❌ Project with slug '${projectSlug}' already exists in '${orgSlug}'`,
        );
        const result = await inquirer.prompt([
          {
            type: "input",
            name: "newSlug",
            message: "Enter a new slug (or press Ctrl+C to abort):",
            validate: (input) =>
              input.trim().length > 0 ? true : "Slug cannot be empty",
          },
        ]);
        const newSlug = result.newSlug.trim();

        // Retry with new slug
        const retryResponse = await client.callTool({
          name: "PROJECTS_CREATE",
          arguments: {
            org: orgSlug,
            slug: newSlug,
            title: projectTitle,
            description: projectDescription,
          },
        });

        if (retryResponse.isError) {
          throw new Error(
            `Failed to create project with slug '${newSlug}': ${retryResponse.content}`,
          );
        }

        const retryResult = retryResponse.structuredContent as {
          id: string;
          slug: string;
        };
        projectId = retryResult.id;
        projectSlug = newSlug; // Update projectSlug with the new slug!
        console.log(
          `   ✅ Project created with slug '${newSlug}' (ID: ${projectId})\n`,
        );
      } else {
        throw new Error(errorMsg);
      }
    } else {
      const result = createResponse.structuredContent as {
        id: string;
        slug: string;
      };
      projectId = result.id;
      console.log(`   ✅ Project created (ID: ${projectId})\n`);
    }
  } finally {
    await client.close();
  }

  // Step 6: Push files to the new project
  console.log("📤 Pushing files to project...");
  const projectWorkspace = `/${orgSlug}/${projectSlug}`;
  const ignoreChecker = createIgnoreChecker(fromDir);

  const filesToUpload: Array<{ remotePath: string; localPath: string }> = [];

  for (const root of ALLOWED_ROOTS) {
    const localRoot = path.join(fromDir, root.slice(1));
    if (!existsSync(localRoot)) {
      continue;
    }

    async function walkDir(dir: string, baseRemotePath: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const basePrefix = baseRemotePath.replace(/^\/+/, "");

      for (const entry of entries) {
        const localPath = path.join(dir, entry.name);

        if (ignoreChecker.isIgnored(localPath)) {
          continue;
        }

        const joinedRemote = `${baseRemotePath}/${entry.name}`.replace(
          /\\/g,
          "/",
        );
        const sanitizedRelativePath = sanitizeProjectPath(joinedRemote);

        if (!sanitizedRelativePath) {
          console.warn(`   ⚠️  Skipping unsafe path: ${joinedRemote}`);
          continue;
        }

        if (!sanitizedRelativePath.startsWith(basePrefix)) {
          continue;
        }

        const nextRemotePath = `/${sanitizedRelativePath}`;

        if (entry.isDirectory()) {
          await walkDir(localPath, nextRemotePath);
        } else if (entry.isFile()) {
          filesToUpload.push({ remotePath: nextRemotePath, localPath });
        }
      }
    }

    await walkDir(localRoot, root);
  }

  console.log(`   Found ${filesToUpload.length} files to upload`);

  let uploadedCount = 0;

  await runWithConcurrency(
    filesToUpload,
    5,
    async ({ remotePath, localPath }) => {
      try {
        const content = await fs.readFile(localPath, "utf-8");

        if (remotePath.endsWith(".json")) {
          try {
            JSON.parse(content);
          } catch {
            console.warn(`   ⚠️  Skipping malformed JSON file: ${remotePath}`);
            return;
          }
        }

        if (/[^\x20-\x7E\r\n\t]/.test(content)) {
          console.warn(`   ⚠️  Skipping binary file: ${remotePath}`);
          return;
        }

        const deconfigPath = mapToRemotePath(remotePath);

        await putFileContent(
          deconfigPath,
          content,
          "main",
          undefined,
          projectWorkspace,
          local,
        );

        const current = ++uploadedCount;
        if (current % 10 === 0 || current === filesToUpload.length) {
          console.log(
            `   Uploaded ${current}/${filesToUpload.length} files...`,
          );
        }
      } catch (error) {
        console.error(
          `   ❌ Failed to upload ${remotePath}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  console.log(`   ✅ Uploaded ${uploadedCount} files\n`);

  // Step 7: Import agents (must use project workspace context)
  console.log("👤 Importing agents...");
  const agentsDir = path.join(fromDir, AGENTS_DIR);
  let agentCount = 0;

  if (existsSync(agentsDir)) {
    // Close the global client and connect to project workspace
    await client.close();
    const projectClient = await createWorkspaceClient({
      workspace: projectWorkspace,
      local,
    });

    try {
      const agentFiles = await fs.readdir(agentsDir);
      const jsonFiles = agentFiles.filter((f) => f.endsWith(".json"));

      console.log(`   Found ${jsonFiles.length} agent files`);

      await runWithConcurrency(jsonFiles, 5, async (agentFile) => {
        try {
          const agentPath = path.join(agentsDir, agentFile);
          const agentContent = await fs.readFile(agentPath, "utf-8");
          const agentData = JSON.parse(agentContent);

          const createAgentResponse = await projectClient.callTool({
            name: "AGENTS_CREATE",
            arguments: agentData,
          });

          if (createAgentResponse.isError) {
            console.error(
              `   ❌ Failed to create agent from ${agentFile}:`,
              createAgentResponse.content,
            );
            return;
          }

          const current = ++agentCount;
          if (current % 5 === 0 || current === jsonFiles.length) {
            console.log(`   Created ${current}/${jsonFiles.length} agents...`);
          }
        } catch (error) {
          console.error(
            `   ❌ Failed to import agent ${agentFile}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      });

      console.log(`   ✅ Imported ${agentCount} agents\n`);
    } finally {
      await projectClient.close();
    }
  } else {
    console.log(`   No agents directory found, skipping\n`);
  }

  // Step 8: Print summary
  console.log("🎉 Import completed successfully!\n");
  console.log("📊 Summary:");
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Project slug: ${projectSlug}`);
  console.log(`   Organization: ${orgSlug}`);
  console.log(`   Files uploaded: ${uploadedCount}`);
  console.log(`   Agents created: ${agentCount}`);

  if (manifest.dependencies.mcps.length > 0) {
    console.log(`\n⚠️  Dependencies detected (not installed):`);
    for (const mcp of manifest.dependencies.mcps) {
      console.log(`      - ${mcp}`);
    }
    console.log(
      `   You may need to install these integrations for full functionality.`,
    );
  }
}
