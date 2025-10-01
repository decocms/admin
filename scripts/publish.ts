import process from "node:process";
interface App {
  name: string; // this is friendly name
  description: string;
  icon: string;
  group: string;
}

interface PublishPayload {
  scopeName: string;
  name: string;
  friendlyName: string;
  description: string;
  icon: string;
  connection: {
    type: string;
    url: string;
  };
  unlisted: boolean;
}

async function fetchApps(): Promise<App[]> {
  console.log("Fetching apps...");

  const response = await fetch("https://api.decocms.com/mcp/groups");

  if (!response.ok) {
    throw new Error(
      `Failed to fetch apps: ${response.status} ${response.statusText}`,
    );
  }

  const apps: App[] = await response.json();
  console.log(`Found ${apps.length} apps to publish`);

  return apps;
}

async function publishApp(
  app: App,
): Promise<{ success: boolean; error?: string }> {
  if (!app.name) {
    console.log(`Skipping app: ${app.name} (no appName)`);
    return { success: true };
  }

  const project = process.env.PROJECT;
  const token = process.env.DECO_TOKEN;

  if (!project) {
    throw new Error("WORKSPACE environment variable is required");
  }

  if (!token) {
    throw new Error("DECO_TOKEN environment variable is required");
  }

  const scopeName = "deco";
  const payload: PublishPayload = {
    scopeName,
    name: app.group,
    friendlyName: app.name,
    description: app.description,
    icon: app.icon,
    connection: {
      type: "HTTP",
      url: `https://api.decocms.com/mcp/${app.group}`,
    },
    unlisted: false,
  };

  const url = `https://api.decocms.com${project}/tools/call/REGISTRY_PUBLISH_APP`;

  try {
    console.log(`Publishing app: ${app.name} (@${scopeName}/${app.group})`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `${response.status} ${response.statusText}: ${errorText}`,
      };
    }

    console.log(`✅ Successfully published: ${app.name}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function publishInBatches(
  apps: App[],
  batchSize: number = 10,
): Promise<void> {
  const totalBatches = Math.ceil(apps.length / batchSize);
  let successCount = 0;
  let errorCount = 0;

  console.log(
    `Publishing ${apps.length} apps in ${totalBatches} batches of ${batchSize}...`,
  );

  for (let i = 0; i < apps.length; i += batchSize) {
    const batch = apps.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    console.log(
      `\n🚀 Processing batch ${batchNumber}/${totalBatches} (${batch.length} apps)...`,
    );

    // Process batch in parallel
    const promises = batch.map((app) => publishApp(app));
    const results = await Promise.all(promises);

    // Count results
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const app = batch[j];

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        console.error(`❌ Failed to publish ${app.name}: ${result.error}`);
      }
    }

    console.log(
      `Batch ${batchNumber} completed. Success: ${
        results.filter((r) => r.success).length
      }, Errors: ${results.filter((r) => !r.success).length}`,
    );

    // Small delay between batches to avoid overwhelming the API
    if (i + batchSize < apps.length) {
      console.log("Waiting 500ms before next batch...");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`\n📊 Final Results:`);
  console.log(`✅ Successfully published: ${successCount} apps`);
  console.log(`❌ Failed to publish: ${errorCount} apps`);
  console.log(
    `📈 Success rate: ${((successCount / apps.length) * 100).toFixed(1)}%`,
  );
}

async function main() {
  try {
    // Fetch apps
    const apps = await fetchApps();

    if (apps.length === 0) {
      console.log("No apps found to publish");
      return;
    }

    // Publish apps in batches
    await publishInBatches(apps, 10);
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

// Run the script if this file is executed directly
await main();
