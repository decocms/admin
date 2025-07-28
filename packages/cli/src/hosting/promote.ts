import { Confirm, Input, Select } from "@cliffy/prompt";
import { createWorkspaceClient } from "../mcp.ts";

interface Options {
  workspace: string;
  appSlug: string;
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
  appSlug,
  deploymentId,
  routePattern,
  skipConfirmation = false,
}: Options) => {
  console.log(
    `🚀 Promoting deployment for app '${appSlug}' in workspace '${workspace}'...`,
  );

  const client = await createWorkspaceClient({ workspace });

  // First, get the list of deployments for the app
  const deploymentsResponse = await client.callTool({
    name: "HOSTING_APP_DEPLOYMENTS_LIST",
    arguments: { appSlug },
  });

  if (
    deploymentsResponse.isError && Array.isArray(deploymentsResponse.content)
  ) {
    throw new Error(
      deploymentsResponse.content[0]?.text ?? "Failed to list deployments",
    );
  }

  const { deployments, app } = deploymentsResponse
    .structuredContent as AppDeploymentsResponse;

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
        name: `${dep.id} - ${
          new Date(dep.created_at).toLocaleString()
        } (${dep.entrypoint})`,
        value: dep.id,
      }));

      selectedDeploymentId = await Select.prompt({
        message: "Select deployment to promote:",
        options: deploymentOptions,
      });
    }
  }

  const selectedDeployment = deployments.find((d) =>
    d.id === selectedDeploymentId
  );
  if (!selectedDeployment) {
    throw new Error(`Deployment ${selectedDeploymentId} not found`);
  }

  let selectedRoutePattern = routePattern;

  // If route pattern not provided, ask user to input it
  if (!selectedRoutePattern) {
    selectedRoutePattern = await Input.prompt({
      message: "Enter route pattern to promote to:",
      default: `${appSlug}.deco.page`,
      validate: (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return "Route pattern is required";
        return true;
      },
    });
  }

  // Show confirmation
  if (!skipConfirmation) {
    console.log("\n📋 Promotion Summary:");
    console.log(`  App: ${app.slug}`);
    console.log(`  Deployment: ${selectedDeploymentId}`);
    console.log(`  Entrypoint: ${selectedDeployment.entrypoint}`);
    console.log(`  Route Pattern: ${selectedRoutePattern}`);

    const confirmed = await Confirm.prompt({
      message: "Do you want to proceed with the promotion?",
      default: true,
    });

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
