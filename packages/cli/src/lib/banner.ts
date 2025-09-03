import chalk from "chalk";

/**
 * Displays a simple DECO ASCII art banner
 */
export function displayBanner({ version: v }: { version: string }): void {
  const deco = chalk.green(`
██████╗ ███████╗ ██████╗ ██████╗ 
██╔══██╗██╔════╝██╔════╝██╔═══██╗
██║  ██║█████╗  ██║     ██║   ██║
██║  ██║██╔══╝  ██║     ██║   ██║
██████╔╝███████╗╚██████╗╚██████╔╝
╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ 
`);

  const subtitle = chalk.gray("Creating Deco project");
  const version = chalk.dim(`CLI v${v}`);

  console.log(deco);
  console.log(`  ${subtitle}`);
  console.log(`  ${version}`);
  console.log("");
}
