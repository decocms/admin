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
  },
};

/**
 * Writes the MCP configuration to the specified target path.
 * Creates the directory structure if it doesn't exist.
 *
 * @param config - The configuration object to write
 * @param targetPath - The path where to write the configuration
 */
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

export async function promptMCPInstall(
  mcpConfig: MCPConfig,
  projectRoot: string,
): Promise<{ config: MCPConfig; configPath: string } | null> {
  // Ask if user wants to make their IDE sentient
  const wantsSentientIDE = await Confirm.prompt({
    message: "Would you like to make your IDE sentient?",
    default: true,
  });

  if (!wantsSentientIDE) {
    return null;
  }

  // Prompt user to select their IDE
  const selectedIDE = await Select.prompt({
    message: "Which IDE are you using?",
    options: [
      { name: "Cursor", value: "cursor" },
      { name: "VS Code", value: "vscode" },
    ],
  });

  const ideSupport = IDE_SUPPORT[selectedIDE];
  if (!ideSupport) {
    throw new Error(`Unsupported IDE: ${selectedIDE}`);
  }

  // Create the IDE-specific configuration
  const { config, configPath } = await ideSupport.createConfig(mcpConfig, projectRoot);

  console.log(
    `\n✨ Your ${ideSupport.name} will now be able to test this project!`,
  );

  return { config, configPath };
}
