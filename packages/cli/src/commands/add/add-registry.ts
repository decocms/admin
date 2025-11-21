import inquirer from "inquirer";
import {
  type DecoBinding,
  getConfig,
  readWranglerConfig,
  writeConfigFile,
} from "../../lib/config.js";
import { promptRegistry } from "../../lib/prompt-registry.js";
import { readSession } from "../../lib/session.js";
import { createWorkspaceClientStub } from "../../lib/mcp.js";
import { sanitizeConstantName } from "../../lib/slugify.js";
import { genEnv } from "../gen/gen.js";
import { getAppDomain } from "../../lib/config.js";
import { writeFile } from "fs/promises";
import process from "node:process";

interface AddRegistryCommandOptions {
  workspace?: string;
  local?: boolean;
  appName?: string;
  skipGen?: boolean;
}

export async function addRegistryCommand({
  workspace,
  local,
  appName,
  skipGen = false,
}: AddRegistryCommandOptions) {
  try {
    // Check if user has a session
    const session = await readSession();
    if (!session) {
      console.error("❌ No session found. Please run 'deco login' first.");
      return;
    }

    // Get current config
    const config = await getConfig({
      inlineOptions: { workspace, local },
    }).catch(() => ({
      workspace: workspace || session.workspace || "default",
      bindings: [],
      local: local || false,
      enable_workflows: true,
    }));

    console.log(`📁 Using workspace: ${config.workspace}`);

    let selectedBindings: Array<{
      name: string;
      type: string;
      integration_name: string;
    }>;

    // If app name is provided, fetch and add it directly
    if (appName) {
      console.log(`🔍 Searching registry for "${appName}"...`);
      // Use API client stub for public registry access (no workspace - global endpoint)
      const apiClient = await createWorkspaceClientStub({
        local: config.local,
      });

      const response = await apiClient.callTool({
        name: "REGISTRY_GET_APP",
        arguments: { name: appName },
      });

      if (response.isError) {
        const errorText =
          response.content?.[0]?.text ??
          `App "${appName}" not found in registry`;
        throw new Error(errorText);
      }

      const app = response.structuredContent as {
        name: string;
        appName: string;
        friendlyName?: string;
      };

      selectedBindings = [
        {
          name: sanitizeConstantName(app.friendlyName || app.name),
          type: "mcp",
          integration_name: app.appName,
        },
      ];

      console.log(`✅ Found app: ${app.friendlyName || app.name}`);
    } else {
      // Interactive mode: prompt user to select apps from registry
      console.log("🔍 Searching registry for available apps...");
      selectedBindings = await promptRegistry(config.local, config.workspace);

      if (selectedBindings.length === 0) {
        console.log("ℹ️  No apps selected. Nothing to add.");
        return;
      }

      console.log(
        `✅ Selected ${selectedBindings.length} app(s) from registry`,
      );
    }

    // Prompt for binding names for each app
    const newBindings: DecoBinding[] = [];
    for (const binding of selectedBindings) {
      const registryBinding = binding as {
        name: string;
        type: string;
        integration_name: string;
      };

      const { bindingName } = await inquirer.prompt([
        {
          type: "input",
          name: "bindingName",
          message: `Enter binding name for app "${registryBinding.integration_name}":`,
          default: registryBinding.name,
          validate: (value: string) => {
            if (!value.trim()) {
              return "Binding name cannot be empty";
            }
            if (!/^[A-Z_][A-Z0-9_]*$/.test(value)) {
              return "Binding name must be uppercase with underscores (e.g., MY_APP)";
            }
            return true;
          },
        },
      ]);

      newBindings.push({
        name: bindingName,
        type: "mcp",
        integration_name: registryBinding.integration_name,
      });
    }

    // Read current wrangler config and get existing bindings
    const currentWranglerConfig = await readWranglerConfig();
    const currentBindings = (currentWranglerConfig.deco?.bindings ||
      []) as DecoBinding[];

    // Simply concat arrays (no deduplication)
    const allBindings = [...currentBindings, ...newBindings];

    // Update config with new bindings
    const updatedConfig = {
      ...config,
      bindings: allBindings,
    };

    // Write updated config
    await writeConfigFile(updatedConfig);

    console.log(`✅ Added ${newBindings.length} app(s) successfully!`);
    newBindings.forEach((binding) => {
      const id =
        "integration_id" in binding
          ? binding.integration_id
          : "integration_name" in binding
            ? binding.integration_name
            : "unknown";
      console.log(`  - ${binding.name} (${id})`);
    });

    // Generate types if not skipped
    if (!skipGen) {
      console.log("\n🔄 Generating environment types...");
      try {
        const wranglerConfig = await readWranglerConfig();
        const env = await genEnv({
          workspace: config.workspace,
          local: config.local,
          bindings: updatedConfig.bindings,
          selfUrl: `https://${getAppDomain(
            config.workspace,
            wranglerConfig.name ?? "my-app",
          )}/mcp`,
        });

        const DEFAULT_OUTPUT_PATH = "shared/deco.gen.ts";
        await writeFile(DEFAULT_OUTPUT_PATH, env);
        console.log(`✅ Types generated at ${DEFAULT_OUTPUT_PATH}`);
      } catch (genError) {
        console.warn(
          "⚠️  Failed to generate types:",
          genError instanceof Error ? genError.message : String(genError),
        );
        console.log("💡 Run 'deco gen' manually to generate types.");
      }
    } else {
      console.log("\n💡 Run 'deco gen' to update your environment types.");
    }

    console.log("🎉 Your apps are ready to use!");
  } catch (error) {
    console.error(
      "❌ Failed to add registry apps:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
