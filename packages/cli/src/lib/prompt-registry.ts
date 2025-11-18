/**
 * Prompts the user to select multiple apps from the registry.
 *
 * This function:
 * 1. Checks if the user has a valid session
 * 2. Creates a workspace client to access global tools
 * 3. Uses the DECO_INTEGRATIONS_SEARCH tool to fetch registry apps
 * 4. Presents a multiple select prompt to the user with search functionality
 * 5. Returns the selected app names as an array
 *
 * @param local - Whether to use local decocms.com instance
 * @param workspace - The workspace to search from
 * @returns Promise<DecoRegistryBinding[]> - The selected registry app bindings
 * @throws Error if no session is found or no apps are available
 */
import inquirer from "inquirer";
// @ts-ignore - does not have types
import inquirerSearchCheckbox from "inquirer-search-checkbox";
import { createWorkspaceClient } from "./mcp.js";
import { readSession } from "./session.js";
import { sanitizeConstantName } from "./slugify.js";
import { z } from "zod";

// Register the search checkbox plugin
inquirer.registerPrompt("search-checkbox", inquirerSearchCheckbox);

interface RegistryApp {
  id: string;
  name: string;
  appName: string;
  description: string;
  icon: string;
  provider: string;
  verified?: boolean | null;
  friendlyName?: string;
}

export interface DecoRegistryBinding {
  name: string;
  type: string;
  integration_name: string;
}

export async function promptRegistry(
  local = false,
  workspace = "",
): Promise<DecoRegistryBinding[]> {
  // Check if user has a session
  const session = await readSession();
  if (!session) {
    throw new Error("No session found. Please run 'deco login' first.");
  }

  // Create workspace client
  const client = await createWorkspaceClient({ workspace, local });

  try {
    // Use DECO_INTEGRATIONS_SEARCH tool to get registry apps
    const response = await client.callTool(
      {
        name: "DECO_INTEGRATIONS_SEARCH",
        arguments: { query: "" }, // Empty query returns all apps
      },
      // @ts-expect-error We need to refactor DECO_INTEGRATIONS_SEARCH to use a proper schema
      z.any(),
    );

    if (response.isError) {
      throw new Error("Failed to fetch registry apps");
    }

    const registryResponse = (
      response.structuredContent as {
        integrations: RegistryApp[];
      }
    )?.integrations;

    const apps = (registryResponse || []).sort((a, b) => {
      // Sort verified apps first, then by name
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;
      return a.name.localeCompare(b.name);
    });

    if (!apps || apps.length === 0) {
      throw new Error("No registry apps found.");
    }

    // Create options for the search checkbox component
    const options = apps.map((app) => ({
      name: `${app.friendlyName || app.name}${app.verified ? " ✓" : ""} - ${app.description || "No description"}`,
      value: app.appName,
      short: app.friendlyName || app.name,
    }));

    // Use inquirer search checkbox to allow multiple selection with search
    const { selectedAppNames } = await inquirer.prompt([
      {
        type: "search-checkbox",
        name: "selectedAppNames",
        message:
          "Select apps from registry (use space to select, enter to confirm):",
        choices: options,
        searchable: true,
        highlight: true,
        searchText: "Type to search registry apps:",
        emptyText: "No apps found matching your search.",
      },
    ]);

    // Convert selected names back to app objects
    const selectedApps = apps.filter((app) =>
      selectedAppNames.includes(app.appName),
    );

    // Return the selected app bindings with integration_name
    return selectedApps.map(({ friendlyName, name, appName }) => ({
      name: sanitizeConstantName(friendlyName || name),
      type: "mcp",
      integration_name: appName,
    }));
  } finally {
    // Clean up the client connection
    await client.close();
  }
}
