import { Input } from "@cliffy/prompt";
import { join } from "@std/path";
import { type Config, getConfig, writeConfigFile } from "./config.ts";
import { genEnv } from "./typings.ts";
import { promptIDESetup, writeIDEConfig } from "./utils/prompt-ide-setup.ts";
import { promptIntegrations } from "./utils/prompt-integrations.ts";
import { promptWorkspace } from "./utils/prompt-workspace.ts";

export async function configureCommand(local?: boolean) {
  const currentConfig = await getConfig({ inlineOptions: { local } })
    .catch((): Partial<Config> => ({}));

  const app = await Input.prompt({
    message: "Enter app name:",
    default: currentConfig.app,
  });

  const workspace = await promptWorkspace(local, currentConfig.workspace);

  // Prompt for MCP installation
  const config = { workspace, app };
  const mcpConfig = await promptIDESetup(config);

  const bindings = await promptIntegrations(local, workspace);

  // Generate environment variables file
  const envContent = await genEnv({ workspace, local, bindings });

  if (mcpConfig) {
    await writeIDEConfig(mcpConfig);
  }
  await writeConfigFile({ workspace, app, bindings });

  const outputPath = join(Deno.cwd(), "deco.gen.ts");
  await Deno.writeTextFile(outputPath, envContent);
  console.log(`✅ Environment types written to: ${outputPath}`);
}
