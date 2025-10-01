import inquirer from "inquirer";
import {
  type Config,
  getConfig,
  readWranglerConfig,
  writeWranglerConfig,
} from "../../lib/config.js";
import { promptWorkspace } from "../../lib/prompt-workspace.js";
import { promptIntegrations } from "../../lib/prompt-integrations.js";
import { promptIDESetup, writeIDEConfig } from "../../lib/prompt-ide-setup.js";
import { genEnv } from "../gen/gen.js";
import { promises as fs } from "fs";
import { join } from "path";
import process from "node:process";

export async function configureCommand(local?: boolean) {
  const currentConfig = await getConfig({ inlineOptions: { local } }).catch(
    (): Partial<Config> => ({}),
  );

  const wranglerConfig = await readWranglerConfig();
  const defaultApp = typeof wranglerConfig.name === "string"
    ? wranglerConfig.name
    : "my-app";

  const { app } = await inquirer.prompt([
    {
      type: "input",
      name: "app",
      message: "Enter app name:",
      default: defaultApp,
    },
  ]);

  // Use the proper workspace prompt
  const workspace = await promptWorkspace(local, currentConfig.workspace);

  // Add MCP configuration
  const mcpConfig = await promptIDESetup({ workspace, app });

  // Add integrations
  const bindings = await promptIntegrations(local, workspace);

  // Generate environment variables file
  const envContent = await genEnv({ workspace, local, bindings });

  // Write IDE config
  if (mcpConfig) {
    await writeIDEConfig(mcpConfig);
  }

  // Write both app name (top-level) and deco config in one go
  await writeWranglerConfig({
    name: app,
    deco: {
      ...wranglerConfig.deco,
      workspace,
      bindings: [...bindings, ...(wranglerConfig.deco?.bindings ?? [])],
    },
  });

  // Write environment types file
  const outputPath = join(process.cwd(), "deco.gen.ts");
  await fs.writeFile(outputPath, envContent);
  console.log(`✅ Environment types written to: ${outputPath}`);

  console.log(`✅ Configuration saved:`);
  console.log(`   App: ${app}`);
  console.log(`   Workspace: ${workspace}`);
}
