import chalk from "chalk";
import { packageInfo as decoCliPackageJson } from "./package-info.js";

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
