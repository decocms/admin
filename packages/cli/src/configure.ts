import { Input } from "@cliffy/prompt";
import { type Config, getConfig, writeConfigFile } from "./config.ts";
import { promptIntegrations } from "./utils/prompt-integrations.ts";
import {
  promptMCPInstall,
  writeMCPConfig,
} from "./utils/prompt-mcp-install.ts";
import { promptWorkspace } from "./utils/prompt-workspace.ts";
import { sanitizeConstantName } from "./utils/slugify.ts";

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
  const mcpConfig = await promptMCPInstall(config);

  const integrations = await promptIntegrations(local, workspace);

  if (mcpConfig) {
    await writeMCPConfig(mcpConfig.config, mcpConfig.configPath);
  }
  await writeConfigFile({
    workspace,
    app,
    bindings: integrations.map(({ name, id }) => ({
      name: sanitizeConstantName(name),
      type: "mcp",
      integration_id: id,
    })),
  });
}
