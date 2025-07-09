import { Input, Select } from "@cliffy/prompt";
import { join } from "@std/path";
import { copy, ensureDir } from "@std/fs";

interface Template {
  name: string;
  description: string;
  repo: string;
  branch?: string;
  path?: string;
}

const AVAILABLE_TEMPLATES: Template[] = [
  {
    name: "base",
    description:
      "A simple template with minimal dependencies. Use this to build your own custom Tools and Workflows.",
    repo: "deco-cx/chat",
    branch: "main",
    path: "packages/cli/template/base",
  },
  // TODO: Add react-app template
  //   {
  //     name: "react-app",
  //     description: "A React application template",
  //     repo: "deco-cx/chat",
  //     branch: "main",
  //     path: "packages/cli/template/react-app"
  //   },
];

async function downloadTemplate(
  template: Template,
  targetDir: string,
): Promise<void> {
  const tempDir = await Deno.makeTempDir();

  try {
    const cloneCmd = new Deno.Command("git", {
      args: [
        "clone",
        "--depth",
        "1",
        "--branch",
        template.branch || "main",
        `https://github.com/${template.repo}.git`,
        tempDir,
      ],
    });

    const cloneResult = await cloneCmd.output();
    if (!cloneResult.success) {
      throw new Error(`Failed to clone template repository: ${template.repo}`);
    }

    const templatePath = join(tempDir, template.path || "");
    const templateExists = await Deno.stat(templatePath).catch(() => false);

    if (!templateExists) {
      throw new Error(`Template '${template.name}' not found in repository`);
    }

    await ensureDir(targetDir);
    await copy(templatePath, targetDir, { overwrite: true });

    console.log(`✅ Template '${template.name}' downloaded successfully!`);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

async function customizeTemplate(
  targetDir: string,
  projectName: string,
): Promise<void> {
  const packageJsonPath = join(targetDir, "package.json");

  try {
    const packageJsonContent = await Deno.readTextFile(packageJsonPath);
    const packageJson = JSON.parse(packageJsonContent);

    packageJson.name = projectName;

    await Deno.writeTextFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
    );
  } catch (error) {
    console.warn(
      "⚠️  Could not customize package.json:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function listTemplates(): void {
  console.log("Available templates:\n");
  AVAILABLE_TEMPLATES.forEach((template, index) => {
    console.log(`${index + 1}. ${template.name} - ${template.description}`);
  });
  console.log(
    "\nUse 'deco create <project-name> --template <template-name>' to create a project with a specific template.",
  );
}

export async function createCommand(
  projectName?: string,
  templateName?: string,
): Promise<void> {
  try {
    if (templateName) {
      const validTemplate = AVAILABLE_TEMPLATES.find((t) =>
        t.name === templateName
      );
      if (!validTemplate) {
        console.error(`❌ Template '${templateName}' not found.`);
        console.log("\nAvailable templates:");
        listTemplates();
        Deno.exit(1);
      }
    }

    const finalProjectName = projectName || await Input.prompt({
      message: "Enter project name:",
      validate: (value) => {
        if (!value.trim()) {
          return "Project name cannot be empty";
        }
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Project name can only contain lowercase letters, numbers, and hyphens";
        }
        return true;
      },
    });

    const targetDir = join(Deno.cwd(), finalProjectName);
    const dirExists = await Deno.stat(targetDir).catch(() => false);

    if (dirExists) {
      const overwrite = await Select.prompt({
        message: `Directory '${finalProjectName}' already exists. Overwrite?`,
        options: ["No", "Yes"],
      });

      if (overwrite === "No") {
        console.log("❌ Project creation cancelled.");
        return;
      }

      await Deno.remove(targetDir, { recursive: true });
    }

    const finalTemplateName = templateName || await Select.prompt({
      message: "Select a template:",
      options: AVAILABLE_TEMPLATES.map((t) => ({
        name: `${t.name} - ${t.description}`,
        value: t.name,
      })),
    });

    const selectedTemplate = AVAILABLE_TEMPLATES.find((t) =>
      t.name === finalTemplateName
    );
    if (!selectedTemplate) {
      throw new Error(`Template '${finalTemplateName}' not found`);
    }

    console.log(`📦 Downloading template '${selectedTemplate.name}'...`);

    await downloadTemplate(selectedTemplate, targetDir);
    await customizeTemplate(targetDir, finalProjectName);

    console.log(`\n🎉 Project '${finalProjectName}' created successfully!`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${finalProjectName}`);
    console.log(`  npm install`);
    console.log(`  deco dev`);
  } catch (error) {
    console.error(
      "❌ Failed to create project:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}
