import { promises as fs } from "fs";
import process from "node:process";
import { createWorkspaceClient } from "../../lib/mcp.js";
import { getConfig } from "../../lib/config.js";

interface PublishCommandOptions {
  friendlyName?: string;
  name?: string;
  description?: string;
  icon?: string;
  connectionType?: string;
  connectionUrl?: string;
  unlisted?: boolean;
  workspace?: string;
  local?: boolean;
}

export async function publishCommand(options: PublishCommandOptions) {
  try {
    // Get configuration
    const config = await getConfig({
      inlineOptions: {
        workspace: options.workspace,
        local: options.local,
      },
    });

    console.log(`📦 Publishing to workspace: ${config.workspace}`);

    if (!options.name) {
      throw new Error("App name is required. Use -n @scope/appName");
    }

    // Parse app name
    const nameWithoutAt = options.name.startsWith("@")
      ? options.name.slice(1)
      : options.name;
    const [scopeName, appName] = nameWithoutAt.split("/");

    if (!scopeName || !appName) {
      throw new Error("App name must be in format @scope/appName");
    }

    // Build connection object
    const connection: {
      url?: string;
      type: string | undefined;
    } = {
      type: options.connectionType,
    };
    if (options.connectionUrl) connection.url = options.connectionUrl;

    const appData = {
      scopeName,
      name: appName,
      friendlyName: options.friendlyName,
      description: options.description,
      icon: options.icon,
      connection,
      unlisted: options.unlisted ?? true,
    };

    // Create MCP client
    const client = await createWorkspaceClient({
      workspace: config.workspace,
      local: config.local,
    });

    console.log(`🚀 Publishing ${appData.scopeName}/${appData.name}...`);

    // Call the REGISTRY_PUBLISH_APP tool
    const response = await client.callTool({
      name: "REGISTRY_PUBLISH_APP",
      arguments: appData,
    });

    if (response.isError && Array.isArray(response.content)) {
      const errorText = response.content[0]?.text;
      throw new Error(`Failed to publish app: ${errorText || "Unknown error"}`);
    }

    console.log("✅ App published successfully!");

    if (
      response.content && Array.isArray(response.content) &&
      response.content[0]?.text
    ) {
      try {
        const publishedApp = JSON.parse(response.content[0].text);
        console.log(`   App ID: ${publishedApp.id}`);
        console.log(`   Scope: ${publishedApp.scopeName}`);
        console.log(`   Name: ${publishedApp.name}`);
        if (publishedApp.friendlyName) {
          console.log(`   Friendly Name: ${publishedApp.friendlyName}`);
        }
        console.log(`   Unlisted: ${publishedApp.unlisted ? "Yes" : "No"}`);
      } catch {
        // If parsing fails, just show success message
      }
    }
  } catch (error) {
    console.error(
      "❌ Failed to publish app:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

export async function publishFromFile(
  filePath: string,
  workspace?: string,
  local?: boolean,
) {
  try {
    console.log(`📖 Loading app data from: ${filePath}`);
    const content = await fs.readFile(filePath, "utf-8");
    const fileData = JSON.parse(content);

    // Parse the name field from file to get scope and app name
    if (!fileData.name) {
      throw new Error("name is required in the JSON file");
    }

    const nameWithoutAt = fileData.name.startsWith("@")
      ? fileData.name.slice(1)
      : fileData.name;
    const [scopeName, appName] = nameWithoutAt.split("/");

    if (!scopeName || !appName) {
      throw new Error("App name in file must be in format @scope/appName");
    }

    // Convert file data to options format
    const options: PublishCommandOptions = {
      name: fileData.name,
      friendlyName: fileData.friendlyName,
      description: fileData.description,
      icon: fileData.icon,
      connectionType: fileData.connection?.type,
      connectionUrl: fileData.connection?.url,
      unlisted: fileData.unlisted,
      workspace,
      local,
    };

    await publishCommand(options);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file ${filePath}: ${error.message}`);
    }
    throw error;
  }
}
