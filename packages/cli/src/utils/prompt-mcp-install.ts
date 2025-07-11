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
import { type Config, getAppUUID, getMCPConfig } from "../config.ts";

type MCPServerConfig = {
  command: string;
  args: string[];
} | {
  url: string;
  type: "http" | "sse";
  headers?: Record<string, string>;
};

interface MCPConfig {
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

/**
 * Writes the MCP configuration to the specified target path.
 * Creates the directory structure if it doesn't exist.
 *
 * @param config - The configuration object to write
 * @param targetPath - The path where to write the configuration
 */
/**
 * Compares two MCP configurations by converting them to sorted JSON strings.
 * This ensures consistent comparison regardless of key ordering.
 */
function compareMCPConfigs(config1: MCPConfig, config2: MCPConfig): boolean {
  const normalizeConfig = (config: MCPConfig) => {
    // Create a normalized version with sorted keys
    const normalized = {
      mcpServers: {} as Record<string, MCPServerConfig>,
    };

    // Sort server keys for consistent comparison
    const sortedKeys = Object.keys(config.mcpServers).sort();
    for (const key of sortedKeys) {
      normalized.mcpServers[key] = config.mcpServers[key];
    }

    return JSON.stringify(normalized, null, 2);
  };

  return normalizeConfig(config1) === normalizeConfig(config2);
}

export async function writeMCPConfig(
  config: MCPConfig,
  targetPath: string,
): Promise<void> {
  // Ensure the directory exists
  await ensureDir(dirname(targetPath));

  // Write the configuration file
  await Deno.writeTextFile(targetPath, JSON.stringify(config, null, 2));

  console.log(`✅ Configuration written to: ${targetPath}`);
}

export const shouldSkipMCPInstall = async (workspace: string, app: string) => {
  const appUUID = await getAppUUID(workspace, app);

  const shouldSkip = localStorage.getItem(`mcp-install-skip-${appUUID}`);

  return shouldSkip === "true" ? true : shouldSkip === "false" ? false : null;
};

export const saveMCPInstallSkip = async (
  workspace: string,
  app: string,
  value: boolean,
) => {
  const appUUID = await getAppUUID(workspace, app);
  localStorage.setItem(`mcp-install-skip-${appUUID}`, value ? "true" : "false");
};

export async function promptMCPInstall(
  cfg: Pick<Config, "workspace" | "app">,
  projectRoot: string = Deno.cwd(),
): Promise<{ config: MCPConfig; configPath: string } | null> {
  const mcpConfig = await getMCPConfig(cfg.workspace, cfg.app);

  const shouldSkip = await shouldSkipMCPInstall(cfg.workspace, cfg.app);

  if (shouldSkip === true) {
    return null;
  }

  // First, try to detect which IDE config files exist to suggest the most likely one
  const existingConfigs = await Promise.all(
    Object.entries(IDE_SUPPORT).map(async ([ideKey, ideSupport]) => {
      const currentConfig = await ideSupport.getConfig(projectRoot);
      return { ideKey, ideSupport, currentConfig };
    }),
  );

  // Find IDEs that have existing configs
  const idesWithConfigs = existingConfigs.find(({ currentConfig }) =>
    currentConfig !== null
  );

  // If we have existing configs, check if any would be different with the new config
  let selectedIDE: string | undefined;
  let ideSupport: IDESupport | undefined;

  if (idesWithConfigs) {
    // Check if any existing config would be different
    const { ideKey, ideSupport: support, currentConfig } = idesWithConfigs;
    const { config: newConfig } = await support.createConfig(
      mcpConfig,
      projectRoot,
    );

    if (compareMCPConfigs(currentConfig!, newConfig)) {
      return null;
    }

    // Config would be different, ask user if they want to update
    const wantsUpdate = shouldSkip === false || await Confirm.prompt({
      message: `Would you like to update your ${support.name} configuration?`,
      default: true,
    });

    await saveMCPInstallSkip(cfg.workspace, cfg.app, !wantsUpdate);

    if (!wantsUpdate) {
      return null;
    }

    selectedIDE = ideKey;
    ideSupport = support;
  } else {
    // No existing configs, ask if user wants to make IDE sentient
    const wantsSentientIDE = await Confirm.prompt({
      message: "Would you like to configure your IDE to use this project?",
      default: true,
    });

    await saveMCPInstallSkip(cfg.workspace, cfg.app, !wantsSentientIDE);

    if (!wantsSentientIDE) {
      return null;
    }

    // Prompt user to select their IDE
    selectedIDE = await Select.prompt({
      message: "Which IDE are you using?",
      options: [
        { name: "Cursor", value: "cursor" },
        { name: "VS Code", value: "vscode" },
      ],
    });

    ideSupport = IDE_SUPPORT[selectedIDE];
  }

  if (!ideSupport) {
    throw new Error(`Unsupported IDE: ${selectedIDE}`);
  }

  // Create the IDE-specific configuration
  const { config, configPath } = await ideSupport.createConfig(
    mcpConfig,
    projectRoot,
  );

  console.log(
    `\n✨ Your ${ideSupport.name} is now configured!`,
  );

  return { config, configPath };
}
