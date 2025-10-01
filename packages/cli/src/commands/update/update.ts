import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";
import { glob } from "glob";
import inquirer from "inquirer";
import chalk from "chalk";
import process from "node:process";

// Hardcoded Deco dependencies to manage
const DECO_DEPENDENCIES = ["@deco/workers-runtime"] as const;

const DECO_DEV_DEPENDENCIES = ["deco-cli"] as const;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface DependencyUpdate {
  name: string;
  currentVersion: string;
  latestVersion: string;
  isDev: boolean;
  packagePath: string;
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

const formatVersionForPackageJson = (
  packageName: string,
  version: string,
): string => {
  if (packageName === "@deco/workers-runtime") {
    return `npm:@jsr/deco__workers-runtime@${version}`;
  }
  return `^${version}`;
};

const discoverWorkspaces = async (rootPath: string): Promise<string[]> => {
  const rootPackageJsonPath = resolve(rootPath, "package.json");
  if (!existsSync(rootPackageJsonPath)) {
    throw new Error("No package.json found in the current directory");
  }

  const rootPackageJson: PackageJson & { workspaces?: string[] } = JSON.parse(
    await readFile(rootPackageJsonPath, "utf-8"),
  );

  if (!rootPackageJson.workspaces) {
    // Not a workspace, return just the root package.json
    return [rootPackageJsonPath];
  }

  const packageJsonPaths: string[] = [rootPackageJsonPath];

  // Find all package.json files in workspace directories
  for (const workspacePattern of rootPackageJson.workspaces) {
    const workspaceDirs = await glob(workspacePattern, {
      cwd: rootPath,
    });

    for (const dir of workspaceDirs) {
      const packageJsonPath = resolve(rootPath, dir, "package.json");
      if (existsSync(packageJsonPath)) {
        packageJsonPaths.push(packageJsonPath);
      }
    }
  }

  return packageJsonPaths;
};

const findPackageJsons = async (cwd: string): Promise<string[]> => {
  return await discoverWorkspaces(cwd);
};

const checkForUpdates = async (
  packageJsonPath: string,
): Promise<DependencyUpdate[]> => {
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
              packagePath: packageJsonPath,
            });
          }
        } catch (error) {
          console.warn(
            chalk.yellow(
              `⚠️  Failed to check updates for ${depName}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          );
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
              packagePath: packageJsonPath,
            });
          }
        } catch (error) {
          console.warn(
            chalk.yellow(
              `⚠️  Failed to check updates for ${depName}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          );
        }
      }
    }
  }

  return updates;
};

const checkAllPackagesForUpdates = async (
  packageJsonPaths: string[],
): Promise<DependencyUpdate[]> => {
  const allUpdates: DependencyUpdate[] = [];

  for (const packageJsonPath of packageJsonPaths) {
    try {
      const updates = await checkForUpdates(packageJsonPath);
      allUpdates.push(...updates);
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️  Failed to check updates for ${packageJsonPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }

  return allUpdates;
};

const applyUpdates = async (updates: DependencyUpdate[]): Promise<void> => {
  // Group updates by package path
  const updatesByPackage = new Map<string, DependencyUpdate[]>();

  for (const update of updates) {
    if (!updatesByPackage.has(update.packagePath)) {
      updatesByPackage.set(update.packagePath, []);
    }
    updatesByPackage.get(update.packagePath)!.push(update);
  }

  // Apply updates to each package
  for (const [packageJsonPath, packageUpdates] of updatesByPackage) {
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson: PackageJson = JSON.parse(packageJsonContent);

    for (const update of packageUpdates) {
      const newVersionString = formatVersionForPackageJson(
        update.name,
        update.latestVersion,
      );

      if (update.isDev && packageJson.devDependencies) {
        packageJson.devDependencies[update.name] = newVersionString;
      } else if (!update.isDev && packageJson.dependencies) {
        packageJson.dependencies[update.name] = newVersionString;
      }

      const relativePath = packageJsonPath.replace(process.cwd(), ".");
      console.log(
        chalk.green(
          `✅ Updated ${update.name} in ${relativePath}: ${update.currentVersion} → ${update.latestVersion}`,
        ),
      );
    }

    await writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + "\n",
    );
  }
};

export async function updateCommand(options: { yes?: boolean }): Promise<void> {
  try {
    const cwd = process.cwd();
    console.log(chalk.blue("🔍 Searching for Deco dependencies to update..."));

    // Find all package.json files (workspace-aware)
    const packageJsonPaths = await findPackageJsons(cwd);

    if (packageJsonPaths.length === 1) {
      console.log(chalk.gray(`Found package.json at: ${packageJsonPaths[0]}`));
    } else {
      console.log(
        chalk.gray(
          `Found ${packageJsonPaths.length} package.json files in workspace:`,
        ),
      );
      for (const path of packageJsonPaths) {
        const relativePath = path.replace(cwd, ".");
        console.log(chalk.gray(`  - ${relativePath}`));
      }
    }

    // Check for updates across all packages
    const updates = await checkAllPackagesForUpdates(packageJsonPaths);

    if (updates.length === 0) {
      console.log(chalk.green("✅ All Deco dependencies are up to date!"));
      return;
    }

    // Display available updates
    console.log();
    console.log(chalk.yellow("📦 Available updates:"));
    for (const update of updates) {
      const depType = update.isDev ? "(dev)" : "";
      const relativePath = update.packagePath.replace(cwd, ".");
      console.log(
        chalk.blue(
          `  ${update.name} ${depType} in ${relativePath}: ${update.currentVersion} → ${update.latestVersion}`,
        ),
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
          message: `Update ${updates.length} Deco ${
            updates.length === 1 ? "dependency" : "dependencies"
          }?`,
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
    await applyUpdates(updates);

    console.log();
    console.log(chalk.green("🎉 Dependencies updated successfully!"));
    console.log(
      chalk.blue(
        "💡 Don't forget to run your package manager to install the new versions.",
      ),
    );
  } catch (error) {
    console.error(
      chalk.red("❌ Failed to update dependencies:"),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
