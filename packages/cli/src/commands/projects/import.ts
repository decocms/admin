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
import {
  viewCodeToJson,
  toolCodeToJson,
  workflowCodeToJson,
  detectResourceType,
} from "@deco/sdk/mcp/projects/code-conversion";

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
const DATABASE_DIR = "database";

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

type WorkspaceClient = Awaited<ReturnType<typeof createWorkspaceClient>>;

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

        // Convert code files back to JSON before uploading
        let finalContent = content;
        let finalRemotePath = remotePath;

        const resourceType = detectResourceType(localPath);
        if (resourceType) {
          try {
            let jsonResource;
            if (resourceType === "view") {
              jsonResource = viewCodeToJson(content);
              finalRemotePath = remotePath.replace(/\.tsx$/, ".json");
            } else if (resourceType === "tool") {
              jsonResource = toolCodeToJson(content);
              finalRemotePath = remotePath.replace(/\.ts$/, ".json");
            } else if (resourceType === "workflow") {
              jsonResource = workflowCodeToJson(content);
              finalRemotePath = remotePath.replace(/\.ts$/, ".json");
            }

            if (jsonResource) {
              finalContent = JSON.stringify(jsonResource, null, 2);
            }
          } catch (conversionError) {
            console.warn(
              `   ⚠️  Failed to convert ${localPath} to JSON: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`,
            );
            return;
          }
        } else if (remotePath.endsWith(".json")) {
          // Validate JSON files
          try {
            JSON.parse(content);
          } catch {
            console.warn(`   ⚠️  Skipping malformed JSON file: ${remotePath}`);
            return;
          }
        }

        if (/[^\x20-\x7E\r\n\t]/.test(finalContent)) {
          console.warn(`   ⚠️  Skipping binary file: ${remotePath}`);
          return;
        }

        const deconfigPath = mapToRemotePath(finalRemotePath);

        await putFileContent(
          deconfigPath,
          finalContent,
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

  // Step 7: Import database schema and agents (project-context operations)
  const databasesDir = path.join(fromDir, DATABASE_DIR);
  const agentsDir = path.join(fromDir, AGENTS_DIR);

  let tablesImported = 0;
  let agentCount = 0;
  let projectClient: WorkspaceClient | null = null;

  const ensureProjectClient = async () => {
    if (!projectClient) {
      projectClient = await createWorkspaceClient({
        workspace: projectWorkspace,
        local,
      });
    }
    return projectClient;
  };

  try {
    if (existsSync(databasesDir)) {
      const tableFiles = (await fs.readdir(databasesDir)).filter((name) =>
        name.endsWith(".json"),
      );

      if (tableFiles.length > 0) {
        console.log("🗄️ Importing database schema...");
        const projectClientInstance = await ensureProjectClient();

        await runWithConcurrency(tableFiles, 3, async (fileName) => {
          try {
            const filePath = path.join(databasesDir, fileName);
            const raw = await fs.readFile(filePath, "utf-8");
            const parsed = JSON.parse(raw) as {
              name?: string;
              createSql?: string;
              indexes?: Array<{ name?: string; sql?: string }>;
            };

            if (!parsed?.name || !parsed?.createSql) {
              console.warn(
                `   ⚠️  Skipping invalid database schema file: ${fileName}`,
              );
              return;
            }

            const tableName = parsed.name;
            const indexes = Array.isArray(parsed.indexes)
              ? parsed.indexes.filter((index) => typeof index?.sql === "string")
              : [];

            await projectClientInstance.callTool({
              name: "DATABASES_RUN_SQL",
              arguments: {
                sql: parsed.createSql,
              },
            });

            for (const index of indexes) {
              await projectClientInstance.callTool({
                name: "DATABASES_RUN_SQL",
                arguments: {
                  sql: String(index.sql),
                },
              });
            }

            tablesImported++;
            console.log(`   Imported table ${tableName}`);
          } catch (error) {
            console.error(
              `   ❌ Failed to import database schema from ${fileName}:`,
              error instanceof Error ? error.message : String(error),
            );
          }
        });

        console.log(`   ✅ Imported ${tablesImported} tables\n`);
      } else {
        console.log("   No database tables found, skipping\n");
      }
    } else {
      console.log("   No database schema directory found, skipping\n");
    }

    if (existsSync(agentsDir)) {
      console.log("👤 Importing agents...");
      const projectClientInstance = await ensureProjectClient();
      const agentFiles = await fs.readdir(agentsDir);
      const jsonFiles = agentFiles.filter((f) => f.endsWith(".json"));

      console.log(`   Found ${jsonFiles.length} agent files`);

      await runWithConcurrency(jsonFiles, 5, async (agentFile) => {
        try {
          const agentPath = path.join(agentsDir, agentFile);
          const agentContent = await fs.readFile(agentPath, "utf-8");
          const agentData = JSON.parse(agentContent);

          const createAgentResponse = await projectClientInstance.callTool({
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
    } else {
      console.log("👤 No agents directory found, skipping\n");
    }
  } finally {
    const maybeClosable = projectClient as
      | (WorkspaceClient & { close?: () => Promise<void> | void })
      | null;
    if (maybeClosable?.close) {
      await maybeClosable.close();
    }
  }

  // Step 8: Print summary
  console.log("🎉 Import completed successfully!\n");
  console.log("📊 Summary:");
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Project slug: ${projectSlug}`);
  console.log(`   Organization: ${orgSlug}`);
  console.log(`   Files uploaded: ${uploadedCount}`);
  console.log(`   Database tables imported: ${tablesImported}`);
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
