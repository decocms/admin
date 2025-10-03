import inquirer from "inquirer";
import { promises as fs } from "fs";
import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { copy, ensureDir } from "../../lib/fs.js";
import {
  type Config,
  readWranglerConfig,
  writeWranglerConfig,
} from "../../lib/config.js";
import { slugify } from "../../lib/slugify.js";
import { promptWorkspace } from "../../lib/prompt-workspace.js";
import { genEnv } from "../gen/gen.js";
import { promptIDESetup, writeIDEConfig } from "../../lib/prompt-ide-setup.js";
import { readSession } from "../../lib/session.js";
import { loginCommand } from "../auth/login.js";
import { displayBanner } from "../../lib/banner.js";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Template {
  name: string;
  description: string;
  repo: string;
  branch?: string;
  path?: string;
  wranglerRoot?: string;
  /**
   * Paths to remove from the original
   * repository after cloning.
   */
  pathsToIgnore?: string[];
}

const DEFAULT_TEMPLATE: Template = {
  name: "Deco MCP app",
  description: "A Deco MCP app",
  repo: "deco-cx/deco-create",
  branch: "main",
  pathsToIgnore: [],
};

function runCommand(
  command: string,
  args: string[],
  cwd?: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(command, args, {
      cwd,
      stdio: "pipe",
    });

    process.on("close", (code) => {
      resolve(code === 0);
    });

    process.on("error", () => {
      resolve(false);
    });
  });
}

const PATHS_TO_IGNORE_ALWAYS = [".git"];

async function downloadTemplate(
  template: Template,
  targetDir: string,
): Promise<void> {
  // For the base template, use the local copy
  if (template.name === "base") {
    const templatePath = join(__dirname, "../../../template/base");
    await ensureDir(targetDir);
    await copy(templatePath, targetDir, { overwrite: true });
    console.log(`✅ Template '${template.name}' copied successfully!`);
    return;
  }

  // For remote templates, use git clone
  const tempDir = join(process.cwd(), `.temp-${Date.now()}`);

  try {
    const success = await runCommand("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      template.branch || "main",
      `https://github.com/${template.repo}.git`,
      tempDir,
    ]);

    if (!success) {
      throw new Error(`Failed to clone template repository: ${template.repo}`);
    }

    const pathsToIgnore = [
      ...(template.pathsToIgnore || []),
      ...PATHS_TO_IGNORE_ALWAYS,
    ];

    for (const path of pathsToIgnore) {
      try {
        const pathToRemove = join(tempDir, path);
        const isDirectory = await fs
          .stat(pathToRemove)
          .then((stat) => stat.isDirectory());
        await fs.rm(
          pathToRemove,
          isDirectory ? { recursive: true, force: true } : { force: true },
        );
      } catch {
        console.warn(`Failed to remove ${path} from the original template`);
      }
    }

    const templatePath = join(tempDir, template.path || "");
    try {
      await fs.access(templatePath);
    } catch {
      throw new Error(`Template '${template.name}' not found in repository`);
    }

    await ensureDir(targetDir);
    await copy(templatePath, targetDir, { overwrite: true });

    console.log(`✅ Template '${template.name}' downloaded successfully!`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function customizeTemplate({
  targetDir,
  projectName,
  workspace,
  wranglerRoot,
}: {
  targetDir: string;
  projectName: string;
  workspace?: string;
  wranglerRoot?: string;
}): Promise<void> {
  const packageJsonPath = join(targetDir, "package.json");

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    packageJson.name = projectName;

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.warn(
      "⚠️  Could not customize package.json:",
      error instanceof Error ? error.message : String(error),
    );
  }

  // Write config file with project name and workspace
  if (workspace) {
    try {
      // Read current config from target directory
      const currentConfig = await readWranglerConfig(wranglerRoot || targetDir);

      // For now, use empty bindings - we can enhance this later with prompt integrations
      const bindings = currentConfig.deco?.bindings || [];

      // Merge with new project name and workspace - preserve all existing config
      const newConfig = {
        ...currentConfig,
        name: projectName,
        scope: workspace,
        deco: {
          ...currentConfig.deco,
          workspace,
          bindings,
        },
      };

      // Write the new config file
      await writeWranglerConfig(newConfig, wranglerRoot || targetDir);

      // Generate environment variables file
      const envContent = await genEnv({
        workspace: workspace,
        local: false,
        bindings: newConfig.deco.bindings || [],
      });

      const outputPath = join(wranglerRoot || targetDir, "deco.gen.ts");
      await fs.writeFile(outputPath, envContent);
      console.log(`✅ Environment types written to: ${outputPath}`);
    } catch (error) {
      console.warn(
        "⚠️  Could not update config file:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export async function createCommand(
  projectName?: string,
  config: Partial<Config> = {},
): Promise<void> {
  try {
    // Clear the terminal for a clean experience
    console.clear();

    // Display the capybara banner
    displayBanner();

    let session = await readSession();
    if (!session) {
      console.log("🔐 No session found. Starting authentication process...");
      try {
        await loginCommand();
        console.log("✅ Successfully logged in to admin.decocms.com");
        session = await readSession();
      } catch (error) {
        console.error(
          "❌ Login failed:",
          error instanceof Error ? error.message : String(error),
        );
        console.warn(
          "⚠️  Continuing without authentication. You can run 'deco login' later for a better experience.",
        );
      }
    }

    const selectedTemplate = DEFAULT_TEMPLATE;

    const finalProjectName = slugify(
      projectName ||
        (
          await inquirer.prompt([
            {
              type: "input",
              name: "projectName",
              message: "Enter project name:",
              validate: (value: string) => {
                if (!value.trim()) {
                  return "Project name cannot be empty";
                }
                if (!/^[a-z0-9-]+$/.test(value)) {
                  return "Project name can only contain lowercase letters, numbers, and hyphens";
                }
                return true;
              },
            },
          ])
        ).projectName,
    );

    // Prompt user to select workspace if we have a session
    let workspace: string | undefined = config?.workspace;
    if (session) {
      try {
        workspace = await promptWorkspace(config?.local, workspace);
        console.log(`📁 Selected workspace: ${workspace}`);
      } catch (error) {
        console.error(
          "❌ Failed to select workspace:",
          error instanceof Error ? error.message : String(error),
        );
        console.warn(
          "⚠️  Could not select workspace. Continuing without workspace selection.",
        );
        // Continue without workspace
      }
    } else {
      console.log(
        "⚠️  No authentication session - skipping workspace selection",
      );
    }

    const targetDir = join(process.cwd(), finalProjectName);
    try {
      await fs.access(targetDir);

      const { overwrite } = await inquirer.prompt([
        {
          type: "list",
          name: "overwrite",
          message: `Directory '${finalProjectName}' already exists. Overwrite?`,
          choices: ["No", "Yes"],
        },
      ]);

      if (overwrite === "No") {
        console.log("❌ Project creation cancelled.");
        return;
      }

      await fs.rm(targetDir, { recursive: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    const wranglerRoot = join(targetDir, selectedTemplate.wranglerRoot || "");

    const { initGit } = await inquirer.prompt([
      {
        type: "list",
        name: "initGit",
        message: "Initialize a git repository?",
        choices: ["No", "Yes"],
      },
    ]);

    // Prompt user to install MCP configuration for IDE
    const mcpResult = workspace
      ? await promptIDESetup({ workspace, app: finalProjectName }, targetDir)
      : null;

    console.log(`📦 Downloading template '${selectedTemplate.name}'...`);
    await downloadTemplate(selectedTemplate, targetDir);

    if (mcpResult) {
      await writeIDEConfig(mcpResult);
    }

    await customizeTemplate({
      targetDir,
      projectName: finalProjectName,
      workspace,
      wranglerRoot,
    });

    if (initGit === "Yes") {
      try {
        const success = await runCommand("git", ["init"], targetDir);
        if (success) {
          console.log(`✅ Git repository initialized in '${finalProjectName}'`);
        } else {
          console.warn("⚠️  Failed to initialize git repository");
        }
      } catch (error) {
        console.warn(
          "⚠️  Could not initialize git repository:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    console.log(`\n🎉 Project '${finalProjectName}' created successfully!`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${finalProjectName}`);
    console.log(`  npm install`);
    console.log(`  npm run dev`);
  } catch (error) {
    console.error(
      "❌ Failed to create project:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
