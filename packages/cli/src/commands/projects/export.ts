/**
 * Export a project to a local directory
 */
import fs from "node:fs/promises";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import inquirer from "inquirer";
import { promptWorkspace } from "../../lib/prompt-workspace.js";
import { promptProject } from "../../lib/prompt-project.js";
import { createWorkspaceClient } from "../../lib/mcp.js";
import { fetchFileContent } from "../deconfig/base.js";
import {
  writeManifestFile,
  extractDependenciesFromTools,
} from "../../lib/mcp-manifest.js";

interface ExportOptions {
  org?: string;
  project?: string;
  out?: string;
  local?: boolean;
}

const ALLOWED_ROOTS = [
  "/src/tools",
  "/src/views",
  "/src/workflows",
  "/src/documents",
];
const AGENTS_DIR = "agents";

export async function exportCommand(options: ExportOptions): Promise<void> {
  const { local } = options;

  console.log("📦 Starting project export...\n");

  // Step 1: Resolve org and project
  let orgSlug = options.org;
  if (!orgSlug) {
    orgSlug = await promptWorkspace(local);
  }
  console.log(`📍 Organization: ${orgSlug}`);

  let project = options.project;
  let projectData;
  if (!project) {
    projectData = await promptProject(orgSlug, local);
    project = projectData.slug;
  } else {
    // Fetch project data using global PROJECTS_LIST tool
    const client = await createWorkspaceClient({ workspace: "", local });
    try {
      const response = await client.callTool({
        name: "PROJECTS_LIST",
        arguments: { org: orgSlug },
      });
      if (response.isError) {
        throw new Error(`Failed to fetch projects: ${response.content}`);
      }
      const { items: projects } = response.structuredContent as {
        items: Array<{
          id: string;
          slug: string;
          title: string;
          description?: string;
        }>;
      };
      projectData = projects.find((p) => p.slug === project);
      if (!projectData) {
        throw new Error(
          `Project '${project}' not found in organization '${orgSlug}'`,
        );
      }
    } finally {
      await client.close();
    }
  }
  console.log(`📍 Project: ${projectData.title} (${projectData.slug})\n`);

  // Step 2: Determine output directory
  let outDir: string = options.out || "";
  if (!outDir) {
    const defaultOut = `./${orgSlug}__${projectData.slug}`;
    const result = await inquirer.prompt([
      {
        type: "input",
        name: "outDir",
        message: "Output directory:",
        default: defaultOut,
      },
    ]);
    outDir = result.outDir as string;
  }

  // Check if directory exists and is not empty
  if (existsSync(outDir)) {
    const files = await fs.readdir(outDir);
    if (files.length > 0) {
      throw new Error(
        `Output directory '${outDir}' is not empty. Please specify an empty directory or use --force (not yet implemented).`,
      );
    }
  } else {
    mkdirSync(outDir, { recursive: true });
    console.log(`📁 Created output directory: ${outDir}\n`);
  }

  // Step 3: Connect to project workspace
  const workspace = `/${orgSlug}/${projectData.slug}`;
  const client = await createWorkspaceClient({ workspace, local });

  try {
    // Step 4: Fetch all files from allowed roots
    console.log("📋 Fetching project files...");
    const allFiles: Array<{ path: string; content: string }> = [];
    const resourcesByType: Record<string, string[]> = {
      tools: [],
      views: [],
      workflows: [],
      documents: [],
    };

    for (const root of ALLOWED_ROOTS) {
      const response = await client.callTool({
        name: "LIST_FILES",
        arguments: {
          branch: "main",
          prefix: root,
        },
      });

      if (response.isError) {
        console.warn(`⚠️  Failed to list files in ${root}: ${response.content}`);
        continue;
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

      if (result.count === 0) {
        console.log(`   ${root}: 0 files`);
        continue;
      }

      console.log(`   ${root}: ${result.count} files`);

      // Fetch content for each file
      for (const [filePath] of Object.entries(result.files)) {
        const content = await fetchFileContent(
          filePath,
          "main",
          workspace,
          local,
        );
        const contentStr = content.toString("utf-8");
        allFiles.push({ path: filePath, content: contentStr });

        // Categorize by resource type
        if (filePath.startsWith("/src/tools/")) {
          resourcesByType.tools.push(filePath);
        } else if (filePath.startsWith("/src/views/")) {
          resourcesByType.views.push(filePath);
        } else if (filePath.startsWith("/src/workflows/")) {
          resourcesByType.workflows.push(filePath);
        } else if (filePath.startsWith("/src/documents/")) {
          resourcesByType.documents.push(filePath);
        }

        // Write file to disk, removing /src/ prefix
        let relativePath = filePath.startsWith("/")
          ? filePath.slice(1)
          : filePath;
        // Remove "src/" prefix if present
        if (relativePath.startsWith("src/")) {
          relativePath = relativePath.slice(4);
        }
        const localPath = path.join(outDir, relativePath);
        const dir = path.dirname(localPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        await fs.writeFile(localPath, contentStr, "utf-8");
      }
    }

    console.log(`✅ Downloaded ${allFiles.length} files\n`);

    // Step 5: Export agents
    console.log("👤 Fetching agents...");
    const agentsDir = path.join(outDir, AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    let agentCount = 0;

    try {
      // First, get the list of agent IDs
      const agentsListResponse = await client.callTool({
        name: "AGENTS_LIST",
        arguments: {},
      });

      if (agentsListResponse.isError) {
        console.warn(
          `⚠️  Failed to fetch agents: ${agentsListResponse.content}`,
        );
      } else {
        const agentsListData = agentsListResponse.structuredContent as {
          items: Array<{ id: string; name: string }>;
        };

        console.log(`   Found ${agentsListData.items.length} agents`);

        // Fetch full details for each agent using AGENTS_GET
        for (const agentSummary of agentsListData.items) {
          try {
            const agentResponse = await client.callTool({
              name: "AGENTS_GET",
              arguments: { id: agentSummary.id },
            });

            if (agentResponse.isError) {
              console.warn(
                `   ⚠️  Failed to fetch agent ${agentSummary.name}: ${agentResponse.content}`,
              );
              continue;
            }

            const agent = agentResponse.structuredContent as {
              id: string;
              name: string;
              avatar: string;
              instructions: string;
              description?: string;
              tools_set: Record<string, string[]>;
              max_steps?: number;
              max_tokens?: number;
              model: string;
              memory?: unknown;
              views: unknown;
              visibility: string;
              temperature?: number;
            };

            // Strip environment-specific fields
            const exportAgent = {
              name: agent.name,
              avatar: agent.avatar,
              instructions: agent.instructions,
              description: agent.description,
              tools_set: agent.tools_set,
              max_steps: agent.max_steps,
              max_tokens: agent.max_tokens,
              model: agent.model,
              memory: agent.memory,
              views: agent.views,
              visibility: agent.visibility,
              temperature: agent.temperature,
            };

            // Create a safe filename from agent name
            const safeFilename = agent.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
            const agentFile = path.join(agentsDir, `${safeFilename}.json`);

            await fs.writeFile(
              agentFile,
              JSON.stringify(exportAgent, null, 2) + "\n",
              "utf-8",
            );
            agentCount++;

            // Progress indicator for many agents
            if (agentCount % 5 === 0) {
              console.log(
                `   Exported ${agentCount}/${agentsListData.items.length} agents...`,
              );
            }
          } catch (error) {
            console.warn(
              `   ⚠️  Failed to export agent ${agentSummary.name}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        console.log(`   ✅ Exported ${agentCount} agents\n`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to export agents: ${error}`);
    }

    // Step 6: Extract dependencies
    console.log("🔍 Extracting dependencies...");
    const toolFiles = allFiles.filter((f) => f.path.startsWith("/src/tools/"));
    const dependencies = await extractDependenciesFromTools(toolFiles);
    console.log(
      `   Found ${dependencies.length} MCP dependencies: ${dependencies.join(", ") || "none"}\n`,
    );

    // Step 7: Fetch author info
    console.log("👤 Fetching author info...");
    let userEmail: string | undefined;
    let userId: string | undefined;

    try {
      const profileResponse = await client.callTool({
        name: "PROFILES_GET",
        arguments: {},
      });
      if (!profileResponse.isError) {
        const profile = profileResponse.structuredContent as {
          email?: string;
          id?: string;
        };
        userEmail = profile.email;
        userId = profile.id;
      }
    } catch {
      // Ignore
    }
    console.log(`   User: ${userEmail || "unknown"}\n`);

    // Step 8: Build and write manifest
    console.log("📝 Writing manifest...");

    // Helper to strip /src/ prefix from paths
    const stripSrcPrefix = (paths: string[]): string[] =>
      paths.map((p) => p.replace(/^\/src\//, "/"));

    const manifest = {
      schemaVersion: "1.0" as const,
      project: {
        slug: projectData.slug,
        title: projectData.title,
        description: projectData.description,
      },
      author: {
        orgSlug,
        userId,
        userEmail,
      },
      resources: {
        tools: stripSrcPrefix(resourcesByType.tools),
        views: stripSrcPrefix(resourcesByType.views),
        workflows: stripSrcPrefix(resourcesByType.workflows),
        documents: stripSrcPrefix(resourcesByType.documents),
      },
      dependencies: {
        mcps: dependencies,
      },
      createdAt: new Date().toISOString(),
    };

    await writeManifestFile(outDir, manifest);
    console.log(
      `   ✅ Manifest written to ${path.join(outDir, "deco.mcp.json")}\n`,
    );

    // Step 9: Print summary
    console.log("🎉 Export completed successfully!\n");
    console.log("📊 Summary:");
    console.log(`   Tools: ${resourcesByType.tools.length}`);
    console.log(`   Views: ${resourcesByType.views.length}`);
    console.log(`   Workflows: ${resourcesByType.workflows.length}`);
    console.log(`   Documents: ${resourcesByType.documents.length}`);
    console.log(`   Agents: ${agentCount}`);
    console.log(`   Dependencies: ${dependencies.length}`);
    console.log(`   Output: ${outDir}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("\n💥 Export failed:", errorMessage);
    process.exit(1);
  } finally {
    await client.close();
  }
}
