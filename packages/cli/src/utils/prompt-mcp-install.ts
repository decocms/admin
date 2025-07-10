/**
 * Prompts the user to make their IDE sentient about the project by installing MCP configurations.
 *
 * This function:
 * 1. Asks the user if they want to make their IDE sentient
 * 2. If yes, prompts them to select their IDE (Cursor, VSCode, or Windsurf)
 * 3. Returns the appropriate MCP configuration and target path for the selected IDE
 *
 * @param mcpConfig - The MCP configuration object
 * @param projectRoot - The root path of the project where the config should be written
 * @returns Promise<{ config: any; targetPath: string } | null> - The MCP config and target path, or null if user declines
 */
import { Confirm, Select } from "@cliffy/prompt";
import { ensureDir } from "@std/fs";
import { dirname, join } from "@std/path";
import {
  type Config,
  getAppUUID,
  getMCPConfig,
  getMCPConfigVersion,
} from "../config.ts";

type MCPServerConfig = {
  command: string;
  args: string[];
} | {
  url: string;
  type: "http" | "sse";
  headers?: Record<string, string>;
};

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

interface IDESupport {
  name: string;
  getConfig: (projectRoot: string) => Promise<MCPConfig | null>;
  createConfig: (mcpConfig: MCPConfig, projectRoot: string) => Promise<{
    config: MCPConfig;
    configPath: string;
  }>;
}

const IDE_SUPPORT: Record<string, IDESupport> = {
  cursor: {
    name: "Cursor",
    createConfig: async (mcpConfig: MCPConfig, projectRoot: string) => {
      const configPath = join(projectRoot, ".cursor", "mcp.json");
      const existingConfig: MCPConfig = await Deno.readTextFile(configPath)
        .then(JSON.parse).catch(() => ({ mcpServers: {} }));

      return {
        configPath,
        config: {
          mcpServers: {
            ...(existingConfig.mcpServers || {}),
            ...mcpConfig.mcpServers,
          },
        },
      };
    },
    getConfig: async (projectRoot: string): Promise<MCPConfig> => {
      const configPath = join(projectRoot, ".cursor", "mcp.json");
      return await Deno.readTextFile(configPath)
        .then(JSON.parse).catch(() => null);
    },
  },
  vscode: {
    name: "VS Code",
    createConfig: async (mcpConfig: MCPConfig, projectRoot: string) => {
      const configPath = join(projectRoot, ".vscode", "mcp.json");
      const existingConfig: MCPConfig = await Deno.readTextFile(configPath)
        .then(JSON.parse).catch(() => ({ mcpServers: {} }));

      return {
        configPath,
        config: {
          mcpServers: {
            ...(existingConfig.mcpServers || {}),
            ...mcpConfig.mcpServers,
          },
        },
      };
    },
    getConfig: async (projectRoot: string): Promise<MCPConfig> => {
      const configPath = join(projectRoot, ".vscode", "mcp.json");
      return await Deno.readTextFile(configPath)
        .then(JSON.parse).catch(() => null);
    },
  },
};

export async function writeMCPConfig(
  config: MCPConfig,
  targetPath: string,
): Promise<void> {
  // Ensure the directory exists
  await ensureDir(dirname(targetPath));

  // Write the configuration file
  await Deno.writeTextFile(targetPath, JSON.stringify(config, null, 2));

  console.log(`✅ MCPs configuration written to: ${targetPath}`);
}

export const hasMCPPreferences = async (
  workspace: string,
  app: string,
) => {
  const [appUUID, currentVersion] = await Promise.all([
    getAppUUID(workspace, app),
    getMCPConfigVersion(),
  ]);

  const storedVersion = localStorage.getItem(`mcp-install-version-${appUUID}`);

  return storedVersion === currentVersion;
};

export const setMCPPreferences = async (workspace: string, app: string) => {
  const [appUUID, currentVersion] = await Promise.all([
    getAppUUID(workspace, app),
    getMCPConfigVersion(),
  ]);

  localStorage.setItem(
    `mcp-install-version-${appUUID}`,
    currentVersion,
  );
};

export async function promptMCPInstall(
  cfg: Pick<Config, "workspace" | "app">,
  projectRoot: string = Deno.cwd(),
): Promise<{ config: MCPConfig; configPath: string } | null> {
  await setMCPPreferences(cfg.workspace, cfg.app);

  const mcpConfig = await getMCPConfig(cfg.workspace, cfg.app);

  // First, try to detect which IDE config files exist to suggest the most likely one
  const existingConfigs = await Promise.all(
    Object.entries(IDE_SUPPORT).map(async ([ideKey, ideSupport]) => {
      const currentConfig = await ideSupport.getConfig(projectRoot);
      return { ideKey, ideSupport, currentConfig };
    }),
  );

  // Find IDEs that have existing configs
  const targetIDE = existingConfigs.find(({ currentConfig }) =>
    currentConfig !== null
  );

  // If we have existing configs, check if any would be different with the new config
  let selectedIDE = targetIDE?.ideKey;
  let ideSupport = targetIDE?.ideSupport;

  // No existing configs, ask if user wants to make IDE sentient
  const wantsSentientIDE = await Confirm.prompt({
    message: "Would you like to configure your IDE to use this project?",
    default: true,
  });

  if (!wantsSentientIDE) {
    return null;
  }

  // Prompt user to select their IDE
  selectedIDE = await Select.prompt({
    message: "Select your preferred IDE",
    default: selectedIDE,
    options: [
      { name: "Cursor", value: "cursor" },
      { name: "VS Code", value: "vscode" },
      { name: "None", value: "none" },
    ],
  });

  ideSupport = IDE_SUPPORT[selectedIDE];

  if (selectedIDE === "none") {
    return null;
  }

  // Create the IDE-specific configuration
  const { config, configPath } = await ideSupport.createConfig(
    mcpConfig,
    projectRoot,
  );

  return { config, configPath };
}
