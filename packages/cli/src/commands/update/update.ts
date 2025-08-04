import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";
import inquirer from "inquirer";
import chalk from "chalk";
import process from "node:process";

// Hardcoded Deco dependencies to manage
const DECO_DEPENDENCIES = [
  "@deco/workers-runtime",
] as const;

const DECO_DEV_DEPENDENCIES = [
  "deco-cli",
] as const;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface DependencyUpdate {
  name: string;
  currentVersion: string;
  latestVersion: string;
  isDev: boolean;
}

const getLatestVersion = async (packageName: string): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Handle JSR packages - check JSR registry first
    if (packageName === "@deco/workers-runtime") {
      const response = await fetch(
        "https://jsr.io/@deco/workers-runtime/meta.json",
        {
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as { latest: string };
        return data.latest;
      }
    }

    // Fallback to npm registry
    const response = await fetch(
      `https://registry.npmjs.org/${packageName}/latest`,
      {
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch latest version: ${response.statusText}`);
    }

    const data = (await response.json()) as { version: string };
    return data.version;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out while checking for updates");
    }
    throw error;
  }
};

const parseCurrentVersion = (versionString: string): string => {
  // Handle JSR format: "npm:@jsr/deco__workers-runtime@0.6.3"
  if (versionString.startsWith("npm:@jsr/")) {
    const match = versionString.match(/@([^@]+)$/);
    return match ? match[1] : versionString;
  }
  
  // Handle regular semver versions
  return versionString.replace(/^[\^~]/, "");
};

const formatVersionForPackageJson = (packageName: string, version: string): string => {
  if (packageName === "@deco/workers-runtime") {
    return `npm:@jsr/deco__workers-runtime@${version}`;
  }
  return `^${version}`;
};

const findPackageJson = (cwd: string): string => {
  const packageJsonPath = resolve(cwd, "package.json");
  if (existsSync(packageJsonPath)) {
    return packageJsonPath;
  }
  throw new Error("No package.json found in the current directory");
};

const checkForUpdates = async (packageJsonPath: string): Promise<DependencyUpdate[]> => {
  const packageJsonContent = await readFile(packageJsonPath, "utf-8");
  const packageJson: PackageJson = JSON.parse(packageJsonContent);
  
  const updates: DependencyUpdate[] = [];
  
  // Check regular dependencies
  if (packageJson.dependencies) {
    for (const depName of DECO_DEPENDENCIES) {
      const currentVersionString = packageJson.dependencies[depName];
      if (currentVersionString) {
        try {
          const currentVersion = parseCurrentVersion(currentVersionString);
          const latestVersion = await getLatestVersion(depName);
          
          if (currentVersion !== latestVersion) {
            updates.push({
              name: depName,
              currentVersion,
              latestVersion,
              isDev: false,
            });
          }
        } catch (error) {
          console.warn(chalk.yellow(`⚠️  Failed to check updates for ${depName}: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    }
  }
  
  // Check dev dependencies
  if (packageJson.devDependencies) {
    for (const depName of DECO_DEV_DEPENDENCIES) {
      const currentVersionString = packageJson.devDependencies[depName];
      if (currentVersionString) {
        try {
          const currentVersion = parseCurrentVersion(currentVersionString);
          const latestVersion = await getLatestVersion(depName);
          
          if (currentVersion !== latestVersion) {
            updates.push({
              name: depName,
              currentVersion,
              latestVersion,
              isDev: true,
            });
          }
        } catch (error) {
          console.warn(chalk.yellow(`⚠️  Failed to check updates for ${depName}: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    }
  }
  
  return updates;
};

const applyUpdates = async (packageJsonPath: string, updates: DependencyUpdate[]): Promise<void> => {
  const packageJsonContent = await readFile(packageJsonPath, "utf-8");
  const packageJson: PackageJson = JSON.parse(packageJsonContent);
  
  for (const update of updates) {
    const newVersionString = formatVersionForPackageJson(update.name, update.latestVersion);
    
    if (update.isDev && packageJson.devDependencies) {
      packageJson.devDependencies[update.name] = newVersionString;
    } else if (!update.isDev && packageJson.dependencies) {
      packageJson.dependencies[update.name] = newVersionString;
    }
    
    console.log(
      chalk.green(`✅ Updated ${update.name}: ${update.currentVersion} → ${update.latestVersion}`)
    );
  }
  
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
};

export async function updateCommand(options: { yes?: boolean }): Promise<void> {
  try {
    const cwd = process.cwd();
    console.log(chalk.blue("🔍 Searching for Deco dependencies to update..."));
    
    // Find package.json
    const packageJsonPath = findPackageJson(cwd);
    console.log(chalk.gray(`Found package.json at: ${packageJsonPath}`));
    
    // Check for updates
    const updates = await checkForUpdates(packageJsonPath);
    
    if (updates.length === 0) {
      console.log(chalk.green("✅ All Deco dependencies are up to date!"));
      return;
    }
    
    // Display available updates
    console.log();
    console.log(chalk.yellow("📦 Available updates:"));
    for (const update of updates) {
      const depType = update.isDev ? "(dev)" : "";
      console.log(
        chalk.blue(`  ${update.name} ${depType}: ${update.currentVersion} → ${update.latestVersion}`)
      );
    }
    console.log();
    
    // Confirm updates (unless -y flag is used)
    let confirmed = options.yes || false;
    if (!confirmed) {
      const response = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmed",
          message: `Update ${updates.length} Deco ${updates.length === 1 ? "dependency" : "dependencies"}?`,
          default: true,
        },
      ]);
      confirmed = response.confirmed;
    }
    
    if (!confirmed) {
      console.log(chalk.gray("Update cancelled."));
      return;
    }
    
    // Apply updates
    console.log(chalk.yellow("🔄 Updating dependencies..."));
    await applyUpdates(packageJsonPath, updates);
    
    console.log();
    console.log(chalk.green("🎉 Dependencies updated successfully!"));
    console.log(chalk.blue("💡 Don't forget to run your package manager to install the new versions."));
    
  } catch (error) {
    console.error(
      chalk.red("❌ Failed to update dependencies:"),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}