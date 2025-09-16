import inquirer from "inquirer";
import { createWorkspaceClient } from "../../lib/mcp.js";

interface Options {
  workspace: string;
  appSlug?: string;
  local?: boolean;
  deploymentId?: string;
  routePattern?: string;
  skipConfirmation?: boolean;
}

interface Deployment {
  id: string;
  cloudflare_deployment_id: string | null;
  entrypoint: string;
  created_at: string;
  updated_at: string;
}

interface AppDeploymentsResponse {
  deployments: Deployment[];
  app: {
    id: string;
    slug: string;
    workspace: string;
  };
}

export const promoteApp = async ({
  workspace,
  local,
  appSlug,
  deploymentId,
  routePattern,
  skipConfirmation = false,
}: Options) => {
  const client = await createWorkspaceClient({ workspace, local });

  // If appSlug is not provided, list published apps and let user select
  let selectedAppSlug = appSlug;
  if (!selectedAppSlug) {
    console.log(`🔍 Fetching published apps in workspace '${workspace}'...`);

    const publishedAppsResponse = await client.callTool({
      name: "REGISTRY_LIST_PUBLISHED_APPS",
      arguments: {},
    });

    if (
      publishedAppsResponse.isError &&
      Array.isArray(publishedAppsResponse.content)
    ) {
      throw new Error(
        publishedAppsResponse.content[0]?.text ??
          "Failed to list published apps",
      );
    }

    const { apps } = publishedAppsResponse.structuredContent as {
      apps: Array<{
        name: string;
        friendlyName?: string;
        description?: string;
      }>;
    };

    if (apps.length === 0) {
      console.log("📭 No published apps found in this workspace.");
      return;
    }

    if (apps.length === 1) {
      selectedAppSlug = apps[0].name;
      console.log(
        `📦 Using app: ${selectedAppSlug} (${
          apps[0].friendlyName || apps[0].name
        })`,
      );
    } else {
      // Show apps for selection
      const appOptions = apps.map((app) => ({
        name: `${app.name}${app.friendlyName ? ` (${app.friendlyName})` : ""}${
          app.description ? ` - ${app.description}` : ""
        }`,
        value: app.name,
      }));

      const { selectedApp } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedApp",
          message: "Select app to promote:",
          choices: appOptions,
        },
      ]);
      selectedAppSlug = selectedApp;
    }
  }

  console.log(
    `🚀 Promoting deployment for app '${selectedAppSlug}' in workspace '${workspace}'...`,
  );

  // First, get the list of deployments for the app
  const deploymentsResponse = await client.callTool({
    name: "HOSTING_APP_DEPLOYMENTS_LIST",
    arguments: { appSlug: selectedAppSlug },
  });

  if (
    deploymentsResponse.isError &&
    Array.isArray(deploymentsResponse.content)
  ) {
    throw new Error(
      deploymentsResponse.content[0]?.text ?? "Failed to list deployments",
    );
  }

  const { deployments, app } =
    deploymentsResponse.structuredContent as AppDeploymentsResponse;

  if (deployments.length === 0) {
    console.log("📭 No deployments found for this app.");
    return;
  }

  let selectedDeploymentId = deploymentId;

  // If deployment ID not provided, ask user to select one
  if (!selectedDeploymentId) {
    if (deployments.length === 1) {
      selectedDeploymentId = deployments[0].id;
      console.log(
        `📦 Using deployment: ${selectedDeploymentId} (${
          deployments[0].entrypoint
        })`,
      );
    } else {
      // Show deployments with creation time
      const deploymentOptions = deployments.map((dep) => ({
        name: `${dep.id} - ${new Date(
          dep.created_at,
        ).toLocaleString()} (${dep.entrypoint})`,
        value: dep.id,
      }));

      const { selectedDeployment } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedDeployment",
          message: "Select deployment to promote:",
          choices: deploymentOptions,
        },
      ]);
      selectedDeploymentId = selectedDeployment;
    }
  }

  const selectedDeployment = deployments.find(
    (d) => d.id === selectedDeploymentId,
  );
  if (!selectedDeployment) {
    throw new Error(`Deployment ${selectedDeploymentId} not found`);
  }

  let selectedRoutePattern = routePattern;

  // If route pattern not provided, ask user to input it
  if (!selectedRoutePattern) {
    const { routeInput } = await inquirer.prompt([
      {
        type: "input",
        name: "routeInput",
        message: "Enter route pattern to promote to:",
        default: `${selectedAppSlug}.deco.page`,
        validate: (input: string) => {
          const trimmed = input.trim();
          if (!trimmed) return "Route pattern is required";
          return true;
        },
      },
    ]);
    selectedRoutePattern = routeInput;
  }

  // Show confirmation
  if (!skipConfirmation) {
    console.log("\n📋 Promotion Summary:");
    console.log(`  App: ${app.slug}`);
    console.log(`  Deployment: ${selectedDeploymentId}`);
    console.log(`  Entrypoint: ${selectedDeployment.entrypoint}`);
    console.log(`  Route Pattern: ${selectedRoutePattern}`);

    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: "Do you want to proceed with the promotion?",
        default: true,
      },
    ]);

    if (!confirmed) {
      console.log("❌ Promotion cancelled.");
      return;
    }
  }

  // Perform the promotion
  try {
    const promoteResponse = await client.callTool({
      name: "HOSTING_APPS_PROMOTE",
      arguments: {
        deploymentId: selectedDeploymentId,
        routePattern: selectedRoutePattern,
      },
    });

    if (promoteResponse.isError && Array.isArray(promoteResponse.content)) {
      throw new Error(
        promoteResponse.content[0]?.text ?? "Failed to promote deployment",
      );
    }

    const result = promoteResponse.structuredContent as {
      success: boolean;
      promotedRoute: string;
    };

    if (result.success) {
      console.log("✅ Deployment promoted successfully!");
      console.log(`🌐 Route updated: ${result.promotedRoute}`);
      console.log("🧹 Route cache purged");
    } else {
      throw new Error("Promotion failed");
    }
  } catch (error) {
    console.error("❌ Failed to promote deployment:", error);
    throw error;
  }
};
