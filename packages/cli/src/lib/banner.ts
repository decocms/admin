import chalk from "chalk";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const decoCliPackageJsonPath = join(__dirname, "../../package.json");
const decoCliPackageJson = JSON.parse(
  await readFile(decoCliPackageJsonPath, "utf-8"),
);

/**
 * Displays a simple DECO ASCII art banner
 */
export function displayBanner(): void {
  const deco = chalk.green(`
██████╗ ███████╗ ██████╗ ██████╗ 
██╔══██╗██╔════╝██╔════╝██╔═══██╗
██║  ██║█████╗  ██║     ██║   ██║
██║  ██║██╔══╝  ██║     ██║   ██║
██████╔╝███████╗╚██████╗╚██████╔╝
╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ 
`);

  const subtitle = chalk.gray("Creating Deco project");
  const version = chalk.dim(`CLI v${decoCliPackageJson.version}`);

  console.log(deco);
  console.log(`  ${subtitle}`);
  console.log(`  ${version}`);
  console.log("");
}
