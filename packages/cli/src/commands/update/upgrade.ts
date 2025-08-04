import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import * as semver from "semver";
import inquirer from "inquirer";
import chalk from "chalk";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for current version
const getPackageJson = async () => {
  const packageJsonPath = join(__dirname, "../../../package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
  return packageJson;
};

const getLatestVersion = async (packageName: string): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
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

export const upgrade = (packageName: string): Promise<void> => {
  console.log(chalk.yellow("🔄 Upgrading to the latest version..."));

  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["install", "-g", packageName], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(chalk.green("🎉 CLI updated successfully!"));
        console.log(
          chalk.blue(
            "Please restart your terminal or run 'deco --version' to verify.",
          ),
        );
        resolve();
      } else {
        console.error(chalk.red("❌ Failed to update the CLI."));
        reject(new Error(`npm install failed with exit code ${code}`));
      }
    });

    child.on("error", (error) => {
      console.error(chalk.red("❌ Failed to update the CLI."));
      reject(error);
    });
  });
};

export async function checkForUpdates(): Promise<void> {
  // Skip if we've already checked in this session or if running update command
  if (process.env.DECO_CLI_UPDATE_CHECKED || process.argv.includes("update")) {
    return;
  }
  process.env.DECO_CLI_UPDATE_CHECKED = "true";

  try {
    const packageJson = await getPackageJson();
    const currentVersion = packageJson.version;
    const latestVersion = await getLatestVersion(packageJson.name);

    if (semver.gt(latestVersion, currentVersion)) {
      console.log();
      console.log(
        chalk.green(
          `A new version of deco is available: ${chalk.bold(
            `v${latestVersion}`,
          )}`,
        ),
      );
      console.log(chalk.yellow(`You are on version: v${currentVersion}`));
      console.log();

      const { upgradeConfirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "upgradeConfirm",
          message: "Do you want to upgrade?",
          default: true,
        },
      ]);

      if (upgradeConfirm) {
        await upgrade(packageJson.name);
      }
    }
  } catch (error) {
    // We can ignore this error since it's not critical.
    // Only log in debug mode
    if (process.env.DEBUG) {
      console.debug("Update check failed:", error);
    }
  }
}

export async function upgradeCommand(): Promise<void> {
  try {
    const packageJson = await getPackageJson();
    const currentVersion = packageJson.version;

    console.log(chalk.blue(`Current version: v${currentVersion}`));
    console.log(chalk.blue("Checking for updates..."));

    const latestVersion = await getLatestVersion(packageJson.name);

    if (semver.gt(latestVersion, currentVersion)) {
      console.log(
        chalk.green(
          `📦 New version available: ${chalk.bold(`v${latestVersion}`)}`,
        ),
      );

      const { confirmed } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmed",
          message: `Update from v${currentVersion} to v${latestVersion}?`,
          default: true,
        },
      ]);

      if (confirmed) {
        await upgrade(packageJson.name);
      } else {
        console.log(chalk.gray("Update cancelled."));
      }
    } else if (semver.eq(latestVersion, currentVersion)) {
      console.log(
        chalk.green("✅ You are already running the latest version!"),
      );
    } else {
      console.log(chalk.blue("ℹ️  You are running a development version."));
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Failed to check for updates:"),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
