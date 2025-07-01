import { D1Store } from "@mastra/cloudflare-d1";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";
import { NotFoundError, UserInputError } from "../../errors.ts";
import type { Database } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  type WithTool,
} from "../assertions.ts";
import { type AppContext, createToolGroup, getEnv } from "../context.ts";
import { bundler } from "./bundler.ts";
import { assertsDomainUniqueness } from "./custom-domains.ts";
import {
  type DeployResult,
  deployToCloudflare,
  type WranglerConfig,
} from "./deployment.ts";
import { snapshot } from "node:test";

const SCRIPT_FILE_NAME = "script.mjs";
export const HOSTING_APPS_DOMAIN = ".deco.page";
export const Entrypoint = {
  host: (appSlug: string) => {
    return `${appSlug}${HOSTING_APPS_DOMAIN}`;
  },
  build: (appSlug: string) => {
    return `https://${Entrypoint.host(appSlug)}`;
  },
  script: (domain: string) => {
    if (domain.endsWith(HOSTING_APPS_DOMAIN)) {
      return domain.split(HOSTING_APPS_DOMAIN)[0];
    }
    return null;
  },
};

// Zod schemas for input
const AppSchema = z.object({
  slug: z.string().optional(), // defaults to 'default'
  entrypoint: z.string(),
});

const AppInputSchema = z.object({
  appSlug: z.string(), // defaults to 'default'
});

const DECO_CHAT_HOSTING_APPS_TABLE = "deco_chat_hosting_apps" as const;
const DECO_CHAT_HOSTING_ROUTES_TABLE = "deco_chat_hosting_routes" as const;

type AppRow =
  Database["public"]["Tables"][typeof DECO_CHAT_HOSTING_APPS_TABLE]["Row"];

export type App = z.infer<typeof AppSchema>;

const Mappers = {
  toApp: (
    data: AppRow,
  ): App & {
    id: string;
    workspace: string;
    files: z.infer<typeof FileSchema>[];
  } => {
    const files = Object.entries(
      data.files ?? {} as Record<string, string>,
    ).map((
      [path, content],
    ) => ({
      path,
      content,
    }));
    return {
      id: data.id,
      slug: data.slug,
      entrypoint: Entrypoint.build(data.slug),
      workspace: data.workspace,
      files,
    };
  },
};

const createTool = createToolGroup("Hosting", {
  name: "Hosting & Deployment",
  description: "Deploy serverless apps via Cloudflare Workers.",
  icon:
    "https://assets.decocache.com/mcp/59297cd7-2ecd-452f-8b5d-0ff0d0985232/Hosting--Deployment.png",
});

// 1. List apps for a given workspace
export const listApps = createTool({
  name: "HOSTING_APPS_LIST",
  description: "List all apps for the current tenant",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const { data, error } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .select("*")
      .eq("workspace", workspace);

    if (error) throw error;

    return data.map(Mappers.toApp);
  },
});

function routeKey(route: { route_pattern: string; custom_domain?: boolean }) {
  return `${route.route_pattern}|${!!route.custom_domain}`;
}

async function updateDatabase(
  c: AppContext,
  workspace: string,
  scriptSlug: string,
  result: DeployResult,
  wranglerConfig: WranglerConfig,
  files?: Record<string, string>,
) {
  // Try to update first
  let { data: app, error: updateError } = await c.db
    .from(DECO_CHAT_HOSTING_APPS_TABLE)
    .update({
      updated_at: new Date().toISOString(),
      cloudflare_script_hash: result.etag,
      cloudflare_worker_id: result.id,
      files,
    })
    .eq("slug", scriptSlug)
    .eq("workspace", workspace)
    .select("*")
    .single();

  if (updateError && updateError.code !== "PGRST116") { // PGRST116: Results contain 0 rows
    throw updateError;
  }

  if (!app) {
    // If not updated, insert
    const { data: inserted, error: insertError } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .upsert({
        workspace,
        slug: scriptSlug,
        updated_at: new Date().toISOString(),
        cloudflare_script_hash: result.etag,
        cloudflare_worker_id: result.id,
        files,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;
    app = inserted;
  }
  if (!app) {
    throw new Error("Failed to create or update app.");
  }
  // calculate route diff
  const routes = wranglerConfig.routes ?? [];
  const mappedRoutes = routes.map((r) => ({
    route_pattern: r.pattern,
    custom_domain: r.custom_domain,
  }));

  // 1. Fetch current routes for this app
  const { data: currentRoutes, error: fetchRoutesError } = await c.db
    .from(DECO_CHAT_HOSTING_ROUTES_TABLE)
    .select("id, route_pattern, custom_domain")
    .eq("hosting_app_id", app.id);
  if (fetchRoutesError) throw fetchRoutesError;

  // 2. Build sets for diffing
  const currentRouteMap = new Map(
    (currentRoutes ?? []).map((r) => [routeKey(r), r]),
  );

  const newRouteMap = new Map(
    mappedRoutes.map((
      r,
    ) => [
      routeKey(r),
      r,
    ]),
  );

  // 3. Find routes to delete (in current, not in new)
  const toDelete = (currentRoutes ?? []).filter(
    (r) => !newRouteMap.has(routeKey(r)),
  );
  // 4. Find routes to insert (in new, not in current)
  const toInsert = mappedRoutes.filter(
    (r) =>
      !currentRouteMap.has(
        routeKey(r),
      ),
  );

  // 5. Perform insertions and deletions in parallel
  await Promise.all([
    toDelete.length > 0
      ? c.db
        .from(DECO_CHAT_HOSTING_ROUTES_TABLE)
        .delete()
        .in(
          "id",
          toDelete.map((r) => r.id),
        )
      : Promise.resolve(),
    toInsert.length > 0
      ? c.db
        .from(DECO_CHAT_HOSTING_ROUTES_TABLE)
        .upsert(
          toInsert.map((route) => ({
            hosting_app_id: app.id,
            route_pattern: route.route_pattern,
            custom_domain: route.custom_domain ?? false,
          })),
          {
            onConflict: "hosting_app_id,route_pattern,custom_domain",
          },
        )
      : Promise.resolve(),
  ]);

  return Mappers.toApp(app);
}

const MIME_TYPES: Record<string, string> = {
  "js": "application/javascript+module",
  "mjs": "application/javascript+module",
  "ts": "application/javascript+module",
  "json": "application/json",
  "wasm": "application/wasm",
  "css": "text/css",
  "html": "text/html",
  "txt": "text/plain",
  "toml": "text/plain",
};

const getMimeType = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "txt";
  return MIME_TYPES[ext] ?? "text/plain";
};

let created = false;
const createNamespaceOnce = async (c: AppContext) => {
  if (created) return;
  created = true;
  const cf = c.cf;
  const env = getEnv(c);
  await cf.workersForPlatforms.dispatch.namespaces.create({
    name: env.CF_DISPATCH_NAMESPACE,
    account_id: env.CF_ACCOUNT_ID,
  }).catch(() => {});
};

// main.ts or main.mjs or main.js or main.cjs
const ENTRYPOINTS = ["main.ts", "main.mjs", "main.js", "main.cjs"];
const CONFIGS = ["wrangler.toml"];

// First, let's define a new type for the file structure
const FileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

const DECO_WORKER_RUNTIME_VERSION = "0.2.0";
// Update the schema in deployFiles
export const deployFiles = createTool({
  name: "HOSTING_APP_DEPLOY",
  description:
    `Deploy multiple TypeScript files that use Deno as runtime for Cloudflare Workers. You must provide a wrangler.toml file matching the Workers for Platforms format. Use 'main_module' instead of 'main', and define bindings using the [[bindings]] array, where each binding is a table specifying its type and properties. To add custom Deco bindings, set type = "MCP" in a binding entry (these will be filtered and handled automatically).

Common patterns:
1. Use a deps.ts file to centralize dependencies:
   // deps.ts
   export { default as lodash } from "npm:lodash";
   export { z } from "npm:zod";
   export { createClient } from "npm:@supabase/supabase-js";

2. Import from deps.ts in your files:
   // main.ts
   import { lodash, z, createClient } from "./deps.ts";

3. Use wrangler.toml to configure your app:
   // wrangler.toml
   name = "app-slug"
   compatibility_date = "2025-06-17"
   main_module = "main.ts"
   kv_namespaces = [
     { binding = "TODO", id = "06779da6940b431db6e566b4846d64db" }
   ]
   routes = [
     { pattern = "my.example.com", custom_domain = true }
   ]

   browser = { binding = "MYBROWSER" }

   [triggers]
   # Schedule cron triggers:
   crons = [ "*/3 * * * *", "0 15 1 * *", "59 23 LW * *" ]

  [[durable_objects.bindings]]
  name = "MY_DURABLE_OBJECT"
  class_name = "MyDurableObject"

   [ai]
   binding = "AI"

   [[queues.consumers]]
    queue = "queues-web-crawler"
    max_batch_timeout = 60

    [[queues.producers]]
    queue = "queues-web-crawler"
    binding = "CRAWLER_QUEUE"

   [[deco.bindings]]
   type = "MCP"
   name = "MY_BINDING"
   value = "INTEGRATION_ID"

   [[workflows]]
    # name of your workflow
    name = "workflows-starter"
    # binding name env.MY_WORKFLOW
    binding = "MY_WORKFLOW"
    # this is class that extends the Workflow class in src/index.ts
    class_name = "MyWorkflow"

   # You can add any supported binding type as per Workers for Platforms documentation.
4. You should always surround the user fetch with the withRuntime function.


import { withRuntime } from "jsr:@deco/workers-runtime@${DECO_WORKER_RUNTIME_VERSION}";
import { DeleteModelInput } from '../models/api';

export default withRuntime({
  fetch: async (request: Request, env: any) => {
    return new Response("Hello from Deno on Cloudflare!");
  }
});

You must use the Workers for Platforms TOML format for wrangler.toml. The bindings supports all standard binding types (ai, analytics_engine, assets, browser_rendering, d1, durable_object_namespace, hyperdrive, kv_namespace, mtls_certificate, plain_text, queue, r2_bucket, secret_text, service, tail_consumer, vectorize, version_metadata, etc). For Deco-specific bindings, use type = "MCP".
For routes, only custom domains are supported. The user must point their DNS to the script endpoint. $SCRIPT.deco.page using DNS-Only. The user needs to wait for the DNS to propagate before the app will be available.

Example of files deployment:
[
  {
    "path": "main.ts",
    "content": \`
      import { z } from "./deps.ts";
      import { withRuntime } from "jsr:@deco/workers-runtime@${DECO_WORKER_RUNTIME_VERSION}";


      export default withRuntime({
        async fetch(request: Request, env: any): Promise<Response> {
          return new Response("Hello from Deno on Cloudflare!");
        }
      })
    \`
  },
  {
    "path": "deps.ts",
    "content": \`
      export { z } from "npm:zod";
    \`
  },
  {
    "path": "wrangler.toml",
    "content": \`
      name = "app-slug"
   compatibility_date = "2025-06-17"
   main_module = "main.ts"
   kv_namespaces = [
     { binding = "TODO", id = "06779da6940b431db6e566b4846d64db" }
   ]

   browser = { binding = "MYBROWSER" }

   [triggers]
   # Schedule cron triggers:
   crons = [ "*/3 * * * *", "0 15 1 * *", "59 23 LW * *" ]

  [[durable_objects.bindings]]
  name = "MY_DURABLE_OBJECT"
  class_name = "MyDurableObject"

   [ai]
   binding = "AI"

   [[queues.consumers]]
    queue = "queues-web-crawler"
    max_batch_timeout = 60

    [[queues.producers]]
    queue = "queues-web-crawler"
    binding = "CRAWLER_QUEUE"

   [[deco.bindings]]
   type = "MCP"
   name = "MY_BINDING"
   value = "INTEGRATION_ID"

   [[workflows]]
    # name of your workflow
    name = "workflows-starter"
    # binding name env.MY_WORKFLOW
    binding = "MY_WORKFLOW"
    # this is class that extends the Workflow class in src/index.ts
    class_name = "MyWorkflow"
    \`
  }
]

Important Notes:
- You can access the app workspace by accessing env.DECO_CHAT_WORKSPACE
- You can access the app script slug by accessing env.DECO_CHAT_SCRIPT_SLUG
- Token and workspace can be used to make authenticated requests to the Deco API under https://api.deco.chat
- Always use Cloudflare Workers syntax with export default and proper fetch handler signature
- When using template literals inside content strings, escape backticks with a backslash (\\) or use string concatenation (+)
- Do not use Deno.* namespace functions
- Use npm: or jsr: specifiers for dependencies
- No package.json or deno.json needed
- Dependencies are imported directly using npm: or jsr: specifiers`,
  inputSchema: z.object({
    appSlug: z.string().optional().describe(
      "The slug identifier for the app, if not provided, you should use the wrangler.toml file to determine the slug (using the name field).",
    ),
    files: z.array(FileSchema).describe(
      "An array of files with their paths and contents. Must include main.ts as entrypoint",
    ),
    envVars: z.record(z.string(), z.string()).optional().describe(
      "An optional object of environment variables to be set on the worker",
    ),
    bundle: z.boolean().optional().default(true).describe(
      "If false, skip the bundler step and upload the files as-is. Default: true (bundle files)",
    ),
  }),
  handler: async ({ appSlug: _appSlug, files, envVars, bundle = true }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    // Convert array to record for bundler or direct upload
    const filesRecord = files.reduce((acc, file) => {
      acc[file.path] = file.content;
      return acc;
    }, {} as Record<string, string>);

    const wranglerFile = CONFIGS.find((file) => file in filesRecord);
    const wranglerConfig: WranglerConfig = wranglerFile
      // deno-lint-ignore no-explicit-any
      ? parseToml(filesRecord[wranglerFile]) as any as WranglerConfig
      : { name: _appSlug } as WranglerConfig;

    // check if the entrypoint is in the files
    const entrypoints = [
      ...ENTRYPOINTS,
      wranglerConfig.main ?? wranglerConfig.main_module ?? "main.ts",
    ];
    const entrypoint = entrypoints.find((entrypoint) =>
      entrypoint in filesRecord
    );
    if (!entrypoint) {
      throw new UserInputError(
        `Entrypoint not found in files. Entrypoint must be one of: ${
          [...new Set(entrypoints)].join(", ")
        }`,
      );
    }

    if (!wranglerConfig?.name) {
      throw new UserInputError(
        `App slug not found in wrangler.toml`,
      );
    }

    const appSlug = wranglerConfig.name;

    await createNamespaceOnce(c);
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const scriptSlug = appSlug;

    let fileObjects: Record<string, File>;
    if (bundle) {
      // Bundle the files
      const bundledScript = await bundler(filesRecord, entrypoint);
      fileObjects = {
        [SCRIPT_FILE_NAME]: new File(
          [bundledScript],
          SCRIPT_FILE_NAME,
          { type: "application/javascript+module" },
        ),
      };
    } else {
      fileObjects = Object.fromEntries(
        Object.entries(filesRecord).map(([path, content]) => [
          path,
          new File([content], path, { type: getMimeType(path) }),
        ]),
      );
    }

    const appEnvVars = {
      DECO_CHAT_WORKSPACE: workspace,
      DECO_CHAT_SCRIPT_SLUG: scriptSlug,
    };

    await Promise.all(
      (wranglerConfig.routes ?? []).map((route) =>
        route.custom_domain &&
        assertsDomainUniqueness(c, route.pattern, scriptSlug)
      ),
    );

    const result = await deployToCloudflare(
      c,
      wranglerConfig,
      bundle ? SCRIPT_FILE_NAME : entrypoint,
      fileObjects,
      { ...envVars, ...appEnvVars },
    );
    const data = await updateDatabase(
      c,
      workspace,
      scriptSlug,
      result,
      wranglerConfig,
      filesRecord,
    );
    return {
      entrypoint: data.entrypoint,
      id: data.id,
      workspace: data.workspace,
    };
  },
});

// Delete app (and worker)
export const deleteApp = createTool({
  name: "HOSTING_APP_DELETE",
  description: "Delete an app and its worker",
  inputSchema: AppInputSchema,
  handler: async ({ appSlug }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const scriptSlug = appSlug;

    const cf = c.cf;
    const env = getEnv(c);
    const namespace = env.CF_DISPATCH_NAMESPACE;

    // 1. Delete worker script from Cloudflare
    try {
      await cf.workersForPlatforms.dispatch.namespaces.scripts.delete(
        namespace,
        scriptSlug,
        {
          account_id: env.CF_ACCOUNT_ID,
        },
      );
    } catch {
      // Optionally, log error but don't throw if script doesn't exist
      // (idempotency)
    }

    // 2. Delete from DB
    const { error: dbError } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .delete()
      .eq("workspace", workspace)
      .eq("slug", scriptSlug);

    if (dbError) throw dbError;

    return { success: true };
  },
});

// Get app info (metadata, endpoint, etc)
export const getAppInfo = createTool({
  name: "HOSTING_APP_INFO",
  description: "Get info/metadata for an app (including endpoint)",
  inputSchema: AppInputSchema,
  handler: async ({ appSlug }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const scriptSlug = appSlug;

    // 1. Fetch from DB
    const { data, error } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .select("*")
      .eq("workspace", workspace)
      .eq("slug", scriptSlug)
      .single();

    if (error || !data) {
      throw new NotFoundError("App not found");
    }

    return Mappers.toApp(data);
  },
});

const InputPaginationListSchema = z.object({
  page: z.number().optional(),
  per_page: z.number().optional(),
});

const OutputPaginationListSchema = z.object({
  page: z.number().optional(),
  per_page: z.number().optional(),
});

const getScriptsSetOnWorkspace = async (c: WithTool<AppContext>) => {
  assertHasWorkspace(c);
  const workspace = c.workspace.value;

  const { data, error } = await c.db
    .from(DECO_CHAT_HOSTING_APPS_TABLE)
    .select("cloudflare_worker_id")
    .eq("workspace", workspace);

  if (error) throw error;

  return new Set(data.map((d) => d.cloudflare_worker_id));
};

const getStore = (c: WithTool<AppContext>) => {
  assertHasWorkspace(c);

  return new D1Store({
    accountId: c.envVars.CF_ACCOUNT_ID,
    apiToken: c.envVars.CF_API_TOKEN,
    databaseId: `10fb43b5-d7a7-4fad-92ae-4da127013dfc`, // c.workspace.slug,
  });
};

export const listWorkflows = createTool({
  name: "HOSTING_APP_WORKFLOWS_LIST",
  description: "List all workflows on the workspace",
  inputSchema: InputPaginationListSchema.extend({
    workflowName: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
  outputSchema: z.object({
    workflows: z.array(z.object({
      workflowName: z.string(),
      runId: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      resourceId: z.string().nullable(),
      status: z.string(),
    })).describe("The workflow list names"),
    pagination: OutputPaginationListSchema,
  }),
  handler: async (
    { page = 1, per_page = 10, workflowName, fromDate, toDate },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    // const storageWorkers = getStore(c);

    // const { runs } = await storageWorkers.getWorkflowRuns({
    //   workflowName,
    //   fromDate: fromDate ? new Date(fromDate) : undefined,
    //   toDate: toDate ? new Date(toDate) : undefined,
    //   limit: per_page,
    //   offset: (page - 1) * per_page,
    //   resourceId: undefined,
    // });

    // const transformed = runs.map(({ snapshot, ...run }) => ({
    //   ...run,
    //   status: typeof snapshot === "string" ? snapshot : snapshot.status,
    // }));

    const runs = [
      {
        "workflowName": "antifraud-workflow",
        "runId": "681d6b6b-7d9b-474a-b833-1fbad2a6d02f",
        "createdAt": "2025-07-01T17:47:17.023Z",
        "updatedAt": "2025-07-01T17:47:42.387Z",
        "resourceId": null,
        "status": "success",
      },
      {
        "workflowName": "antifraud-workflow",
        "runId": "ac6e6119-724d-48a7-a308-069422bfe5d9",
        "createdAt": "2025-07-01T17:46:46.885Z",
        "updatedAt": "2025-07-01T17:46:46.885Z",
        "resourceId": null,
        "status": "pending",
      },
      {
        "workflowName": "antifraud-workflow",
        "runId": "1cc25134-881d-4522-a90b-be84e3be22c1",
        "createdAt": "2025-07-01T17:46:29.051Z",
        "updatedAt": "2025-07-01T17:46:29.059Z",
        "resourceId": null,
        "status": "failed",
      },
      {
        "workflowName": "antifraud-workflow",
        "runId": "87862c17-75e9-4e28-8b76-e286b0d6ab06",
        "createdAt": "2025-07-01T17:44:51.731Z",
        "updatedAt": "2025-07-01T17:44:51.741Z",
        "resourceId": null,
        "status": "failed",
      },
     
    ];

    return {
      workflows: runs,
      pagination: { page, per_page },
    };

    // return {
    //   workflows: transformed,
    //   pagination: { page, per_page },
    // };
  },
});

/**
 * TODO: Currently there is no way to filter by script name,
 * this leads to a security issue where a user can see all instances of a workflow
 * on all workspaces.
 *
 * If the user has the workflow id, it can see the workflow details
 */
export const startWorkflow = createTool({
  name: "HOSTING_APP_WORKFLOWS_START",
  description: "Start a workflow and return the instance ID",
  inputSchema: z.object({
    workflowName: z.string(),
    params: z.array(z.object({
      name: z.string(),
      value: z.string(),
    })).optional(),
  }),
  outputSchema: z.object({
    instanceId: z.string().describe("The instance ID of the workflow"),
    workflowName: z.string().describe("The name of the workflow"),
  }),
  handler: async ({ workflowName, params }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const env = getEnv(c);

    const instance = await c.cf.workflows.instances.create(workflowName, {
      account_id: env.CF_ACCOUNT_ID,
      params: params?.reduce((acc, { name, value }) => {
        acc[name] = value;
        return acc;
      }, {} as Record<string, string>),
    });

    return {
      instanceId: instance.id,
      workflowName,
    };
  },
});

/**
 * TODO: Currently there is no way to filter by script name,
 * this leads to a security issue where a user can see all instances of a workflow
 * on all workspaces.
 *
 * If the user has the workflow id, it can see the workflow details
 */
export const getWorkflowStatus = createTool({
  name: "HOSTING_APP_WORKFLOWS_STATUS",
  description: "Get the status of a workflow instance",
  inputSchema: z.object({
    instanceId: z.string().describe(
      "The instance ID of the workflow. To get this, use the HOSTING_APP_WORKFLOWS_INSTANCES_LIST or HOSTING_APP_WORKFLOWS_START tool.",
    ),
    workflowName: z.string(),
  }),
  outputSchema: z.object({
    workflowName: z.string(),
    runId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    resourceId: z.string().nullable(),
    snapshot: z.object({
      status: z.string(),
      result: z.any(),
      context: z.record(
        z.string(),
        z.object({
          payload: z.any(),
          startedAt: z.number(),
          endedAt: z.number(),
          error: z.string().optional(),
          output: z.any().optional(),
        }),
      ),
      serializedStepGraph: z.array(z.object({
        type: z.string(),
        step: z.object({ id: z.string() }),
      })),
    }),
  }),
  handler: async ({ instanceId, workflowName }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    return {
      "workflowName": "antifraud-workflow",
      "runId": "cac598ef-f151-4657-b5e8-61fb188f373f",
      "snapshot": {
          "runId": "cac598ef-f151-4657-b5e8-61fb188f373f",
          "status": "success",
          "value": {},
          "context": {
              "input": {
                  "orderOrUserId": "muYEhT5cHKSnhEDU2oUenI2UztD2"
              },
              "lookup-user-and-order": {
                  "payload": {
                      "orderOrUserId": "muYEhT5cHKSnhEDU2oUenI2UztD2"
                  },
                  "startedAt": 1751395475314,
                  "status": "success",
                  "output": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "numOrders": 5
                  },
                  "endedAt": 1751395479868
              },
              "fetch-last-orders": {
                  "payload": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "numOrders": 5
                  },
                  "startedAt": 1751395479887,
                  "status": "success",
                  "output": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ]
                  },
                  "endedAt": 1751395482786
              },
              "agent-antifraud-analysis": {
                  "payload": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ]
                  },
                  "startedAt": 1751395482799,
                  "status": "success",
                  "output": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ],
                      "risk": "high",
                      "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido."
                  },
                  "endedAt": 1751395496721
              },
              "risk-branch": {
                  "payload": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ],
                      "risk": "high",
                      "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido."
                  },
                  "startedAt": 1751395496748,
                  "status": "success",
                  "output": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ],
                      "risk": "high",
                      "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido."
                  },
                  "endedAt": 1751395496749
              },
              "gather-clearsale-data": {
                  "payload": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ],
                      "risk": "high",
                      "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido."
                  },
                  "startedAt": 1751395496765,
                  "status": "success",
                  "output": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ],
                      "risk": "high",
                      "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido.",
                      "clearsaleData": {
                          "documentType": "CPF",
                          "document": "10988581400",
                          "name": "Jose Jonas Dantas freire",
                          "email": "josejonas123@gmail.com",
                          "birthdate": "1994-06-23",
                          "address": {
                              "zipCode": "76330000"
                          },
                          "phone": {
                              "countryCode": "55",
                              "areaCode": "38",
                              "number": "999129978"
                          }
                      }
                  },
                  "endedAt": 1751395496765
              },
              "clearsale-verification": {
                  "payload": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ],
                      "risk": "high",
                      "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido.",
                      "clearsaleData": {
                          "documentType": "CPF",
                          "document": "10988581400",
                          "name": "Jose Jonas Dantas freire",
                          "email": "josejonas123@gmail.com",
                          "birthdate": "1994-06-23",
                          "address": {
                              "zipCode": "76330000"
                          },
                          "phone": {
                              "countryCode": "55",
                              "areaCode": "38",
                              "number": "999129978"
                          }
                      }
                  },
                  "startedAt": 1751395496779,
                  "status": "success",
                  "output": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ],
                      "risk": "high",
                      "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido.",
                      "clearsaleScore": 4.74
                  },
                  "endedAt": 1751395500597
              },
              "reporting": {
                  "payload": {
                      "user": {
                          "_id": "61d8b6ba999ce7cbf02b8dc0",
                          "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                          "accept_terms": true,
                          "app_id": "ky4xsje2",
                          "birthdate": "23/06/1994",
                          "counts": {
                              "actions": {
                                  "calculate_success": 6,
                                  "completed_orders": 4
                              },
                              "open_tag_orders": 0
                          },
                          "cpf": "10988581400",
                          "device": {
                              "app_version": "3.7.3",
                              "deviceManufacturer": "Apple",
                              "deviceModel": "iPhone10,5",
                              "devicePlatform": "iOS",
                              "deviceVersion": "15.1",
                              "ip": "191.243.20.55",
                              "uuid": "74A0FC99-7B72-4D58-B83A-70CA654029CE"
                          },
                          "email": "josejonas123@gmail.com",
                          "email_lead": "josejonas@gmajs.sn",
                          "email_validation_code": {
                              "code": "251731",
                              "created_at": "2022-01-07T22:19:46.604Z"
                          },
                          "email_verified": false,
                          "enotas": {
                              "id": "474f53bd-4cf7-4555-9774-3948c5f10700"
                          },
                          "hubspot": {
                              "id": 202551
                          },
                          "is_seller": true,
                          "last_order_completed_at": "2022-01-10T14:37:24.670Z",
                          "last_time_opened": "2022-01-07T22:03:22.717Z",
                          "level": 1,
                          "level_set_at": "2022-01-07T21:55:06.952Z",
                          "magento": {
                              "store_credit": 0,
                              "store_credit_history": [
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557405\"]",
                                      "created_at": "2022-01-10 14:37:21",
                                      "customer_history_id": "1",
                                      "customer_id": "24652",
                                      "difference": 134.32,
                                      "history_id": "507169",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "store_credit_balance": 134.32,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "8",
                                      "action_data": "[\"2000557406\"]",
                                      "created_at": "2022-01-10 14:37:25",
                                      "customer_history_id": "2",
                                      "customer_id": "24652",
                                      "difference": 28.66,
                                      "history_id": "507171",
                                      "is_deduct": 0,
                                      "message": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "store_credit_balance": 162.98,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "5",
                                      "action_data": "[\"2000557412\"]",
                                      "created_at": "2022-01-12 20:51:05",
                                      "customer_history_id": "3",
                                      "customer_id": "24652",
                                      "difference": 239.88,
                                      "history_id": "519170",
                                      "is_deduct": 0,
                                      "message": "Etiqueta 2000557412 cancelada.",
                                      "store_credit_balance": 402.86,
                                      "store_id": "0"
                                  },
                                  {
                                      "action": "2",
                                      "action_data": "[]",
                                      "created_at": "2022-01-17 15:57:13",
                                      "customer_history_id": "4",
                                      "customer_id": "24652",
                                      "difference": -402.86,
                                      "history_id": "530945",
                                      "is_deduct": 1,
                                      "message": "[RC]",
                                      "store_credit_balance": 0,
                                      "store_id": "0"
                                  }
                              ]
                          },
                          "mautic": {
                              "id": 397316
                          },
                          "name": "Jose Jonas Dantas freire",
                          "onboarding_has_been_shown": true,
                          "payment": {
                              "last_used_credit_card": {
                                  "details": {
                                      "expirationDate": "11/2023",
                                      "maskedCC": "XXXX-XXXX-XXXX-5904",
                                      "type": "MC"
                                  },
                                  "payment_method_code": "iugu_cc",
                                  "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                  "type": "card"
                              }
                          },
                          "phone_number": "+5538999129978",
                          "profile_completed_steps": {
                              "profile_data": true
                          },
                          "push_token": "ci2jQ0whvE_8gQlhkEMw8F:APA91bE9ZVBYwpNoKBwdRw4tdaPWH-F75h9yFj7G7cK2q77ovyPa4nw9zSN2NUGXuMmU3ehPpAHKiRXoe4h8uNo29fxoIZKyT1m2xAtoWQCDgHLG4Q8YTi6GD7NLZskBC7seTcmux6sO",
                          "register_date": "2022-01-07T21:55:37.624Z",
                          "tag_orders_limit": 0,
                          "tag_orders_limited_manually": true,
                          "first_calculate_success_at": "2022-01-07T21:57:20.644Z",
                          "last_calculate_success_at": "2022-01-07T22:12:21.760Z",
                          "first_order_completed_at": "2022-01-10T14:37:20.754Z",
                          "updated_at": "2023-02-21T01:33:52.884Z"
                      },
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "slackChannelId": "C091TKYTG77",
                      "lastOrders": [
                          {
                              "_id": "61d8bac9999ce7cbf02bb211",
                              "order_id": "RVZbkc3QqAgkWjig29aF",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:12:25.351Z",
                              "data": {
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "expirationDate": "11/2023",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "type": "card"
                                      }
                                  },
                                  "tag": {
                                      "origin": {
                                          "phone": "38999129978",
                                          "region": "GO",
                                          "name": "Douglas Ferreira ",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Quadra 13 lote 04",
                                          "street": "Rua dos Bacuris",
                                          "selected_region": "",
                                          "postcode": "76330000",
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "lastname": "Ferreira ",
                                          "district": "Olinda II",
                                          "city": "Jaraguá",
                                          "askForRegionCity": false,
                                          "complement": "",
                                          "phone_number": "",
                                          "firstname": "Douglas"
                                      },
                                      "destiny": {
                                          "email": "",
                                          "city": "Natal",
                                          "askForRegionCity": false,
                                          "district": "Lagoa Nova",
                                          "street": "Avenida Nascimento de Castro",
                                          "region": "RN",
                                          "selected_region": "",
                                          "name": "Cassio Leandro Nunes Morais ",
                                          "selected_city": "",
                                          "number": "1725 - Cond. Cristal Residence ",
                                          "postcode": "59056450",
                                          "complement": "Apt 1202"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "RVZbkc3QqAgkWjig29aF",
                                  "code": "0001cccf59300c220fed57f5aff59f21"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:12:25.351Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "status": "order_placed",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:15:03.385Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:15:07.195Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:15:15.587Z",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "date": "2022-01-10T12:15:19.967Z",
                                      "status": "tag_posted"
                                  },
                                  "6": {
                                      "date": "2022-01-10T12:15:23.142Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "amount_charged_to_credit_card": 329.1,
                                  "applied_credit_amount": 0,
                                  "use_credit_card": true,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "order": 3,
                                  "bonus": 0,
                                  "total": 291.24,
                                  "receipt_notice_amount": 0,
                                  "delivery_time": 7,
                                  "observation": "",
                                  "total_with_discount": 329.1,
                                  "saturday_delivery": true,
                                  "total_without_discount": 504.1,
                                  "level": 1,
                                  "error": "",
                                  "is_contract": true,
                                  "has_error": false,
                                  "percent_of_total": 13,
                                  "name": "SEDEX",
                                  "self_hand_amount": 0,
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "data": {
                                      "declared_value": null,
                                      "format_code": 1,
                                      "depth": 59,
                                      "is_seller": true,
                                      "diameter": null,
                                      "destination_postcode": "59056-450",
                                      "device_os": "iOS",
                                      "height": 30,
                                      "origin_postcode": "76330-000",
                                      "declared_value_option": null,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "weight": 13,
                                      "width": 40
                                  },
                                  "subtotal": 291.24,
                                  "real_discount_amount": 212.86,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "discount_amount": 175
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T12:15:23.142Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "qty": "1",
                                      "description": "Roupas "
                                  }
                              },
                              "magento_data": {
                                  "cart": "2iND9pTzOb4rwLnJiLrl0bXiZZdqskFH",
                                  "order_number": "2000557421"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63407284 BR",
                                  "plp_master_id": "610464563"
                              },
                              "service_posted": {
                                  "real_discount_amount": 212.86,
                                  "data": {
                                      "depth": "55.0",
                                      "origin_postcode": "76330000",
                                      "width": "35.0",
                                      "height": "32.0",
                                      "declared_value": null,
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "format_code": "1",
                                      "diameter": "0.0",
                                      "destination_postcode": "59056450",
                                      "weight": 12.1
                                  },
                                  "total": 291.24,
                                  "code": "03220",
                                  "date": "2022/01/10",
                                  "total_with_discount": 329.1,
                                  "correios_data": {
                                      "objeto_postal": {
                                          "data_postagem_sara": "20220110",
                                          "codigo_objeto_cliente": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "32.0",
                                              "tipo_objeto": "2",
                                              "dimensao_comprimento": "55.0",
                                              "dimensao_largura": "35.0"
                                          },
                                          "cubagem": "0,00",
                                          "status_processamento": "1",
                                          "valor_cobrado": "291.24",
                                          "numero_comprovante_postagem": "2208991274",
                                          "rt1": "",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "peso": "12100",
                                          "numero_etiqueta": "OS634072847BR",
                                          "restricao_anac": "",
                                          "nacional": {
                                              "bairro_destinatario": "Lagoa Nova",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0",
                                              "uf_destinatario": "RN",
                                              "cep_destinatario": "59056450",
                                              "cidade_destinatario": "Natal",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_nota_fiscal": "",
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000"
                                          },
                                          "destinatario": {
                                              "email_destinatario": "",
                                              "complemento_destinatario": "Apt 1202",
                                              "celular_destinatario": "",
                                              "nome_destinatario": "Cassio Leandro Nunes Morais ",
                                              "telefone_destinatario": "",
                                              "numero_end_destinatario": "1725",
                                              "cpf_cnpj_destinatario": "",
                                              "logradouro_destinatario": "Avenida Nascimento de Castro"
                                          },
                                          "codigo_servico_postagem": "03220"
                                      },
                                      "tipo_arquivo": "Postagem",
                                      "remetente": {
                                          "numero_remetente": "Quadr",
                                          "telefone_remetente": "",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "codigo_administrativo": "20295111",
                                          "complemento_remetente": "",
                                          "cidade_remetente": "Jaraguá",
                                          "celular_remetente": "",
                                          "logradouro_remetente": "Rua dos Bacuris",
                                          "uf_remetente": "GO",
                                          "bairro_remetente": "Olinda II",
                                          "fax_remetente": "",
                                          "nome_remetente": "Douglas Ferreira ",
                                          "numero_contrato": "9912504122",
                                          "numero_diretoria": "50",
                                          "cep_remetente": "76330000",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "ciencia_conteudo_proibido": "S"
                                      },
                                      "versao_arquivo": "2.3",
                                      "forma_pagamento": "",
                                      "plp": {
                                          "mcu_unidade_postagem": "6663",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AC JARAGUA",
                                          "valor_global": "291.24",
                                          "id_plp": "610464563"
                                      }
                                  },
                                  "discount_amount": 175
                              },
                              "completed_at": "2022-01-10T12:15:23.142Z"
                          },
                          {
                              "_id": "61d8ba3b999ce7cbf02bad61",
                              "order_id": "50t4HWgxvZevJnL0oQg3",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:10:03.458Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "firstname": "JOSE",
                                          "district": "Centro",
                                          "street": "Rua Pedro Borges, 20",
                                          "lastname": "LINCOLN ",
                                          "email": "josejonas123@gmail.com",
                                          "complement": "Terreo ac pajeu ",
                                          "phone_number": "",
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "number": "Caixa postal 7532",
                                          "city": "Fortaleza",
                                          "selected_city": "",
                                          "askForRegionCity": false,
                                          "region": "CE",
                                          "name": "JOSE LINCOLN ",
                                          "phone": "38999129978",
                                          "postcode": "60055973"
                                      },
                                      "destiny": {
                                          "name": "Carlos Alberto ",
                                          "email": "",
                                          "askForRegionCity": false,
                                          "district": "Jardim Íris",
                                          "complement": "AP 1606",
                                          "number": "2300 - T3",
                                          "selected_region": "",
                                          "street": "Avenida Raimundo Pereira de Magalhães",
                                          "city": "São Paulo",
                                          "region": "SP",
                                          "selected_city": "",
                                          "postcode": "05145000"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "order_id": "50t4HWgxvZevJnL0oQg3",
                                  "discount_service_code": "03220",
                                  "payment": {
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "details": {
                                              "type": "MC",
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904"
                                          },
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "27204c0d109cc02cbe8b8a015e14f562"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:10:03.458Z",
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:11:36.470Z",
                                      "status": "order_placed"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:11:36.470Z"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:11:41.457Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:11:48.245Z",
                                      "name": "send_tag_email",
                                      "user_notify": true
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:29:17.853Z"
                                  },
                                  "6": {
                                      "date": "2022-01-10T14:29:22.056Z",
                                      "status": "payment_finalized",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 528.12,
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0
                              },
                              "service_calculated": {
                                  "subtotal": 467.36,
                                  "receipt_notice_amount": 0,
                                  "saturday_delivery": false,
                                  "real_discount_amount": 195.54,
                                  "level": 1,
                                  "delivery_time": 1,
                                  "data": {
                                      "format_code": 1,
                                      "height": 40,
                                      "acknowledgment_of_receipt": null,
                                      "depth": 60,
                                      "destination_postcode": "05145-000",
                                      "weight": 3,
                                      "origin_postcode": "60055-973",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "declared_value": null,
                                      "device_os": "iOS",
                                      "is_seller": true,
                                      "width": 60,
                                      "diameter": null
                                  },
                                  "home_delivery": true,
                                  "name": "SEDEX",
                                  "declared_value_amount": 0,
                                  "is_contract": true,
                                  "observation": "",
                                  "error": "",
                                  "total_without_discount": 662.9,
                                  "total_with_discount": 528.12,
                                  "has_observation": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "total": 467.36,
                                  "code": "03220",
                                  "order": 3,
                                  "percent_of_total": 13,
                                  "discount_amount": 134.78,
                                  "has_error": false
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:29:22.056Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas",
                                      "value": "0.01",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "zekPPyBooSUm1SXculBeatTEUAA6uV8Y",
                                  "order_number": "2000557415"
                              },
                              "carrier_data": {
                                  "tag_number": "OS63406305 BR",
                                  "plp_master_id": "610463423"
                              },
                              "service_posted": {
                                  "data": {
                                      "acknowledgment_of_receipt": null,
                                      "weight": 2.4,
                                      "width": "60.0",
                                      "destination_postcode": "05145000",
                                      "declared_value": null,
                                      "format_code": "1",
                                      "height": "40.0",
                                      "depth": "60.0",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "origin_postcode": "60055973",
                                      "diameter": "0.0"
                                  },
                                  "total": 467.36,
                                  "discount_amount": 134.78,
                                  "total_with_discount": 528.12,
                                  "real_discount_amount": 195.54,
                                  "date": "2022/01/10",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "versao_arquivo": "2.3",
                                      "remetente": {
                                          "codigo_administrativo": "20295111",
                                          "numero_remetente": "Caixa",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "ciencia_conteudo_proibido": "S",
                                          "complemento_remetente": "Terreo ac pajeu ",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "logradouro_remetente": "Rua Pedro Borges, 20",
                                          "nome_remetente": "JOSE LINCOLN ",
                                          "bairro_remetente": "Centro",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "cep_remetente": "60055973",
                                          "fax_remetente": "",
                                          "uf_remetente": "CE",
                                          "numero_diretoria": "50",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza"
                                      },
                                      "objeto_postal": {
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_comprimento": "60.0",
                                              "dimensao_altura": "40.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "60.0",
                                              "dimensao_diametro": "0.0"
                                          },
                                          "codigo_servico_postagem": "03220",
                                          "data_postagem_sara": "20220110",
                                          "destinatario": {
                                              "complemento_destinatario": "AP 1606",
                                              "numero_end_destinatario": "2300",
                                              "nome_destinatario": "Carlos Alberto ",
                                              "celular_destinatario": "",
                                              "email_destinatario": "",
                                              "logradouro_destinatario": "Avenida Raimundo Pereira de Magalhães",
                                              "telefone_destinatario": "",
                                              "cpf_cnpj_destinatario": ""
                                          },
                                          "valor_cobrado": "467.36",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "rt2": "",
                                          "numero_etiqueta": "OS634063054BR",
                                          "status_processamento": "1",
                                          "numero_comprovante_postagem": "2209127901",
                                          "peso": "2400",
                                          "nacional": {
                                              "centro_custo_cliente": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "uf_destinatario": "SP",
                                              "valor_nota_fiscal": "",
                                              "serie_nota_fiscal": "",
                                              "valor_a_cobrar": "0,0",
                                              "descricao_objeto": "",
                                              "bairro_destinatario": "Jardim Íris",
                                              "cep_destinatario": "05145000",
                                              "cidade_destinatario": "São Paulo",
                                              "natureza_nota_fiscal": "",
                                              "codigo_usuario_postal": ""
                                          },
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "rt1": ""
                                      },
                                      "forma_pagamento": "",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF PAJEU",
                                          "mcu_unidade_postagem": "424681",
                                          "id_plp": "610463423",
                                          "cartao_postagem": "0075832801",
                                          "valor_global": "467.36"
                                      }
                                  },
                                  "code": "03220"
                              },
                              "completed_at": "2022-01-10T14:29:22.056Z"
                          },
                          {
                              "_id": "61d8b92f999ce7cbf02ba440",
                              "order_id": "FDhnAVKipSUvb1iqywAk",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:05:35.563Z",
                              "data": {
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "street": "Rua Jair comune ",
                                          "postcode": "37580000",
                                          "number": "665",
                                          "district": "Centro ",
                                          "selected_city": "",
                                          "firstname": "Marina",
                                          "cpf_cnpj": "10988581400",
                                          "name": "Marina Righeto ",
                                          "city": "Monte Sião",
                                          "phone_number": "",
                                          "askForRegionCity": false,
                                          "lastname": "Righeto ",
                                          "region": "MG",
                                          "phone": "38999129978",
                                          "email": "josejonas123@gmail.com",
                                          "complement": ""
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "qty": "1",
                                              "value": "0.01",
                                              "description": "Roupas"
                                          }
                                      },
                                      "destiny": {
                                          "askForRegionCity": false,
                                          "city": "Araguaína",
                                          "district": "São João",
                                          "selected_region": "",
                                          "selected_city": "",
                                          "email": "",
                                          "street": "Rua Machado de Assis",
                                          "postcode": "77807140",
                                          "name": "Douglas Rodrigues ",
                                          "complement": "",
                                          "region": "TO",
                                          "number": "810"
                                      }
                                  },
                                  "discount_service_code": "03220",
                                  "order_id": "FDhnAVKipSUvb1iqywAk",
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "public_hash": "9fc2a81a520de8f48acca3bd34903a7a6ac8de9ad55278cb06cf79a9693c0fda",
                                          "payment_method_code": "iugu_cc",
                                          "details": {
                                              "expirationDate": "11/2023",
                                              "maskedCC": "XXXX-XXXX-XXXX-5904",
                                              "type": "MC"
                                          },
                                          "type": "card"
                                      }
                                  },
                                  "code": "7f1570d7e348133138841db2496e22ce"
                              },
                              "history": {
                                  "0": {
                                      "date": "2022-01-07T22:05:35.563Z",
                                      "user_notify": false,
                                      "status": "card_init"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:08:47.882Z",
                                      "user_notify": true
                                  },
                                  "3": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:08:52.205Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "4": {
                                      "date": "2022-01-07T22:08:56.344Z",
                                      "user_notify": true,
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "date": "2022-01-12T20:51:04.798Z",
                                      "user_notify": true,
                                      "status": "order_canceled"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "credit_to_be_used": 0,
                                  "use_store_credit": false,
                                  "use_credit_card": true,
                                  "amount_charged_to_credit_card": 239.88
                              },
                              "service_calculated": {
                                  "data": {
                                      "device_os": "iOS",
                                      "origin_postcode": "37580-000",
                                      "declared_value_option": null,
                                      "self_hand": null,
                                      "height": 32,
                                      "is_seller": true,
                                      "depth": 48,
                                      "weight": 8,
                                      "diameter": null,
                                      "format_code": 1,
                                      "width": 38,
                                      "declared_value": null,
                                      "destination_postcode": "77807-140",
                                      "acknowledgment_of_receipt": null
                                  },
                                  "real_discount_amount": 87.62,
                                  "total": 212.28,
                                  "code": "03220",
                                  "error": "",
                                  "order": 3,
                                  "bonus": 0,
                                  "delivery_time": 7,
                                  "discount_amount": 60.02,
                                  "subtotal": 212.28,
                                  "has_observation": false,
                                  "total_with_discount": 239.88,
                                  "self_hand_amount": 0,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "level": 1,
                                  "saturday_delivery": false,
                                  "has_error": false,
                                  "name": "SEDEX",
                                  "observation": "",
                                  "home_delivery": true,
                                  "is_contract": true,
                                  "percent_of_total": 13,
                                  "total_without_discount": 299.9
                              },
                              "status": "canceled",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-12T20:51:04.798Z",
                              "content_declaration": {
                                  "0": {
                                      "value": "0.01",
                                      "description": "Roupas",
                                      "qty": "1"
                                  }
                              },
                              "magento_data": {
                                  "cart": "7RhIUfyKuQd5liROCr08qOtEuWONMoU4",
                                  "order_number": "2000557412"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610462373",
                                  "tag_number": "OS63403541 BR"
                              }
                          },
                          {
                              "_id": "61d8b8d4999ce7cbf02ba0b4",
                              "order_id": "YU8Ciylf7PGzqJHamkls",
                              "carrier": "correios",
                              "created_at": "2022-01-07T22:04:04.466Z",
                              "data": {
                                  "payment": {
                                      "credit_card": {
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792",
                                              "type": "MC"
                                          },
                                          "payment_method_code": "iugu_cc",
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326",
                                          "type": "card"
                                      },
                                      "use_store_credit": false
                                  },
                                  "code": "8d7003f611622b3be521fa940409fb3e",
                                  "order_id": "YU8Ciylf7PGzqJHamkls",
                                  "tag": {
                                      "destiny": {
                                          "name": "Cristina Pereira de Bastos Santos",
                                          "email": "",
                                          "city": "Inhumas",
                                          "askForRegionCity": false,
                                          "selected_city": "",
                                          "selected_region": "",
                                          "district": "Jardim Raio de Sol",
                                          "region": "GO",
                                          "complement": "",
                                          "postcode": "75407190",
                                          "street": "Rua 1",
                                          "number": "Qd 31 lt 03"
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "qty": "1",
                                              "value": "0.01"
                                          }
                                      },
                                      "origin": {
                                          "email": "josejonas123@gmail.com",
                                          "selected_city": "",
                                          "region": "CE",
                                          "firstname": "Stara",
                                          "district": "Aldeota",
                                          "phone": "38999129978",
                                          "name": "Stara Modas ",
                                          "askForRegionCity": false,
                                          "selected_region": "",
                                          "cpf_cnpj": "10988581400",
                                          "postcode": "60140050",
                                          "number": "88",
                                          "phone_number": "",
                                          "complement": "",
                                          "city": "Fortaleza",
                                          "street": "Rua Jaguaretama",
                                          "lastname": "Modas "
                                      }
                                  },
                                  "discount_service_code": "03220"
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T22:04:04.466Z"
                                  },
                                  "1": {
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true
                                  },
                                  "2": {
                                      "date": "2022-01-07T22:04:58.190Z",
                                      "user_notify": true,
                                      "status": "payment_authorized"
                                  },
                                  "3": {
                                      "date": "2022-01-07T22:06:06.186Z",
                                      "name": "fetch_correios_tag",
                                      "user_notify": false
                                  },
                                  "4": {
                                      "user_notify": true,
                                      "date": "2022-01-07T22:06:11.745Z",
                                      "name": "send_tag_email"
                                  },
                                  "5": {
                                      "status": "tag_posted",
                                      "user_notify": true,
                                      "date": "2022-01-10T14:37:18.615Z"
                                  },
                                  "6": {
                                      "user_notify": true,
                                      "observation": "Crédito na carteira de R$28.66 referente à diferença de valor calculado e postado para o pedido 2000557406.",
                                      "status": "others",
                                      "date": "2022-01-10T14:37:24.440Z"
                                  },
                                  "7": {
                                      "status": "payment_finalized",
                                      "date": "2022-01-10T14:37:24.512Z",
                                      "user_notify": true
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 178.69,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -28.66,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "is_contract": true,
                                  "real_discount_amount": 65.47,
                                  "receipt_notice_amount": 0,
                                  "order": 3,
                                  "has_error": false,
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "name": "SEDEX",
                                  "home_delivery": true,
                                  "total_with_discount": 178.69,
                                  "error": "",
                                  "level": 1,
                                  "declared_value_amount": 0,
                                  "delivery_time": 5,
                                  "saturday_delivery": false,
                                  "percent_of_total": 13,
                                  "total_without_discount": 223.6,
                                  "discount_amount": 44.91,
                                  "observation": "",
                                  "subtotal": 158.13,
                                  "code": "03220",
                                  "data": {
                                      "weight": 5,
                                      "self_hand": null,
                                      "acknowledgment_of_receipt": null,
                                      "device_os": "iOS",
                                      "diameter": null,
                                      "format_code": 1,
                                      "depth": 50,
                                      "is_seller": true,
                                      "destination_postcode": "75407-190",
                                      "origin_postcode": "60140-050",
                                      "height": 30,
                                      "declared_value_option": null,
                                      "declared_value": null,
                                      "width": 35
                                  },
                                  "has_observation": false,
                                  "total": 158.13
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:24.512Z",
                              "content_declaration": {
                                  "0": {
                                      "description": "Roupas ",
                                      "qty": "1",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557406",
                                  "cart": "9jNlYlrkjM7gWN50OwzB1fwupbFhetKm"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610461901",
                                  "tag_number": "OS63401983 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 187.7,
                                  "observation": "",
                                  "real_discount_amount": 54.93,
                                  "code": "03220",
                                  "is_contract": true,
                                  "saturday_delivery": false,
                                  "total": 132.77,
                                  "percent_of_total": 13,
                                  "error": "",
                                  "correios_data": {
                                      "remetente": {
                                          "ciencia_conteudo_proibido": "S",
                                          "logradouro_remetente": "Rua Jaguaretama",
                                          "telefone_remetente": "",
                                          "cidade_remetente": "Fortaleza",
                                          "celular_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "numero_remetente": "88",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "uf_remetente": "CE",
                                          "fax_remetente": "",
                                          "complemento_remetente": "",
                                          "cep_remetente": "60140050",
                                          "numero_diretoria": "50",
                                          "numero_contrato": "9912504122"
                                      },
                                      "plp": {
                                          "id_plp": "610461901",
                                          "cartao_postagem": "0075832801",
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "mcu_unidade_postagem": "425057",
                                          "valor_global": "132.77"
                                      },
                                      "versao_arquivo": "2.3",
                                      "objeto_postal": {
                                          "numero_etiqueta": "OS634019838BR",
                                          "destinatario": {
                                              "telefone_destinatario": "",
                                              "celular_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "complemento_destinatario": "",
                                              "logradouro_destinatario": "Rua 1",
                                              "numero_end_destinatario": "Qd 31",
                                              "email_destinatario": "",
                                              "nome_destinatario": "Cristina Pereira de Bastos Santos"
                                          },
                                          "rt1": "",
                                          "nacional": {
                                              "bairro_destinatario": "Jardim Raio de Sol",
                                              "valor_a_cobrar": "0,0",
                                              "natureza_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "75407190",
                                              "serie_nota_fiscal": "",
                                              "descricao_objeto": "",
                                              "uf_destinatario": "GO",
                                              "codigo_usuario_postal": "",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Inhumas"
                                          },
                                          "numero_comprovante_postagem": "2209140817",
                                          "valor_cobrado": "132.77",
                                          "peso": "4500",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "status_processamento": "1",
                                          "rt2": "",
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "codigo_objeto_cliente": "",
                                          "codigo_servico_postagem": "03220",
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_largura": "35.0",
                                              "dimensao_diametro": "0.0",
                                              "tipo_objeto": "2",
                                              "dimensao_altura": "22.0",
                                              "dimensao_comprimento": "52.0"
                                          }
                                      },
                                      "forma_pagamento": "",
                                      "tipo_arquivo": "Postagem"
                                  },
                                  "home_delivery": true,
                                  "has_observation": false,
                                  "total_with_discount": 150.03,
                                  "declared_value_amount": 0,
                                  "discount_amount": 37.67,
                                  "delivery_time": 5,
                                  "data": {
                                      "weight": 4.5,
                                      "diameter": "0.0",
                                      "declared_value": null,
                                      "destination_postcode": "75407190",
                                      "origin_postcode": "60140050",
                                      "self_hand": null,
                                      "width": "35.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "depth": "52.0",
                                      "height": "22.0",
                                      "format_code": "1"
                                  },
                                  "receipt_notice_amount": 0,
                                  "has_error": false,
                                  "date": "2022/01/10",
                                  "bonus": 0,
                                  "self_hand_amount": 0,
                                  "subtotal": 132.77
                              },
                              "completed_at": "2022-01-10T14:37:24.512Z"
                          },
                          {
                              "_id": "61d8b7ba999ce7cbf02b9692",
                              "order_id": "0HUaXUqDgCZHk0SiQqk5",
                              "carrier": "correios",
                              "created_at": "2022-01-07T21:59:21.865Z",
                              "data": {
                                  "order_id": "0HUaXUqDgCZHk0SiQqk5",
                                  "code": "36db0e401901ba1114ea1c3155cbb586",
                                  "discount_service_code": "03220",
                                  "tag": {
                                      "origin": {
                                          "selected_region": "",
                                          "lastname": "Modas ",
                                          "name": "Stara Modas ",
                                          "selected_city": "",
                                          "firstname": "Stara",
                                          "number": "88",
                                          "email": "josejonas123@gmail.com",
                                          "cpf_cnpj": "10988581400",
                                          "district": "Aldeota",
                                          "city": "Fortaleza",
                                          "region": "CE",
                                          "complement": "",
                                          "postcode": "60140050",
                                          "askForRegionCity": false,
                                          "phone": "38999129978",
                                          "street": "Rua Jaguaretama",
                                          "phone_number": ""
                                      },
                                      "destiny": {
                                          "name": "Edivania Alves Pires ",
                                          "city": "Paracatu",
                                          "postcode": "38603266",
                                          "selected_city": "",
                                          "district": "Paracatuzinho",
                                          "number": "325",
                                          "email": "",
                                          "region": "MG",
                                          "street": "Rua Júlio Wilson Batista",
                                          "selected_region": "",
                                          "complement": "",
                                          "askForRegionCity": false
                                      },
                                      "content_declaration": {
                                          "0": {
                                              "description": "Roupas ",
                                              "value": "0.01",
                                              "qty": "1"
                                          }
                                      }
                                  },
                                  "payment": {
                                      "use_store_credit": false,
                                      "credit_card": {
                                          "payment_method_code": "iugu_cc",
                                          "type": "card",
                                          "details": {
                                              "expirationDate": "6/2027",
                                              "type": "MC",
                                              "maskedCC": "XXXX-XXXX-XXXX-3792"
                                          },
                                          "public_hash": "4f66fc1d76c76018e3a82bca56015b8cc1da4a23ee44c2906df15ef260e8d326"
                                      }
                                  }
                              },
                              "history": {
                                  "0": {
                                      "user_notify": false,
                                      "status": "card_init",
                                      "date": "2022-01-07T21:59:21.865Z"
                                  },
                                  "1": {
                                      "user_notify": true,
                                      "status": "order_placed",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "2": {
                                      "user_notify": true,
                                      "status": "payment_authorized",
                                      "date": "2022-01-07T22:03:12.950Z"
                                  },
                                  "3": {
                                      "correios_tag_request_error": true,
                                      "name": "other",
                                      "user_notify": false,
                                      "date": "2022-01-07T22:03:15.051Z",
                                      "observation": "Erro ao emitir etiqueta nos correios: undefined"
                                  },
                                  "4": {
                                      "user_notify": false,
                                      "date": "2022-01-07T22:04:06.267Z",
                                      "name": "fetch_correios_tag"
                                  },
                                  "5": {
                                      "user_notify": true,
                                      "name": "send_tag_email",
                                      "date": "2022-01-07T22:04:11.347Z"
                                  },
                                  "6": {
                                      "status": "tag_posted",
                                      "date": "2022-01-10T14:37:18.556Z",
                                      "user_notify": true
                                  },
                                  "7": {
                                      "date": "2022-01-10T14:37:20.679Z",
                                      "status": "others",
                                      "observation": "Crédito na carteira de R$134.32 referente à diferença de valor calculado e postado para o pedido 2000557405.",
                                      "user_notify": true
                                  },
                                  "8": {
                                      "date": "2022-01-10T14:37:20.754Z",
                                      "user_notify": true,
                                      "status": "payment_finalized"
                                  }
                              },
                              "payment": {
                                  "applied_credit_amount": 0,
                                  "amount_charged_to_credit_card": 204.67,
                                  "use_store_credit": false,
                                  "credit_to_be_used": -134.32,
                                  "use_credit_card": true
                              },
                              "service_calculated": {
                                  "data": {
                                      "diameter": null,
                                      "destination_postcode": "38603-266",
                                      "weight": 1,
                                      "acknowledgment_of_receipt": null,
                                      "self_hand": null,
                                      "height": 35,
                                      "format_code": 1,
                                      "declared_value_option": null,
                                      "device_os": "iOS",
                                      "width": 35,
                                      "depth": 45,
                                      "declared_value": null,
                                      "origin_postcode": "60140-050"
                                  },
                                  "has_observation": false,
                                  "bonus": 0,
                                  "delivery_time": 2,
                                  "is_contract": true,
                                  "error": "",
                                  "observation": "",
                                  "receipt_notice_amount": 0,
                                  "real_discount_amount": 74.78,
                                  "saturday_delivery": false,
                                  "subtotal": 181.12,
                                  "code": "03220",
                                  "declared_value_amount": 0,
                                  "total_with_discount": 204.67,
                                  "name": "SEDEX",
                                  "total_without_discount": 255.9,
                                  "has_error": false,
                                  "order": 3,
                                  "total": 181.12,
                                  "percent_of_total": 13,
                                  "level": 1,
                                  "home_delivery": true,
                                  "self_hand_amount": 0,
                                  "discount_amount": 51.23
                              },
                              "status": "completed",
                              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                              "updated_at": "2022-01-10T14:37:20.754Z",
                              "content_declaration": {
                                  "0": {
                                      "qty": "1",
                                      "description": "Roupas ",
                                      "value": "0.01"
                                  }
                              },
                              "magento_data": {
                                  "order_number": "2000557405",
                                  "cart": "op3wEI4aOxXc6JCD7eT2wz9GeI4xoHqe"
                              },
                              "carrier_data": {
                                  "plp_master_id": "610456273",
                                  "tag_number": "OS63401663 BR"
                              },
                              "service_posted": {
                                  "total_without_discount": 90.7,
                                  "declared_value_amount": 0,
                                  "receipt_notice_amount": 0,
                                  "self_hand_amount": 0,
                                  "code": "03220",
                                  "is_contract": true,
                                  "observation": "",
                                  "real_discount_amount": 28.44,
                                  "delivery_time": 2,
                                  "data": {
                                      "diameter": "0.0",
                                      "format_code": "1",
                                      "height": "11.0",
                                      "weight": 0.456,
                                      "width": "24.0",
                                      "acknowledgment_of_receipt": null,
                                      "declared_value_option": null,
                                      "origin_postcode": "60140050",
                                      "depth": "30.0",
                                      "declared_value": null,
                                      "self_hand": null,
                                      "destination_postcode": "38603266"
                                  },
                                  "total": 62.26,
                                  "error": "",
                                  "correios_data": {
                                      "tipo_arquivo": "Postagem",
                                      "objeto_postal": {
                                          "codigo_objeto_cliente": "",
                                          "nacional": {
                                              "codigo_usuario_postal": "",
                                              "serie_nota_fiscal": "",
                                              "numero_nota_fiscal": "0000000000",
                                              "centro_custo_cliente": "",
                                              "cidade_destinatario": "Paracatu",
                                              "uf_destinatario": "MG",
                                              "natureza_nota_fiscal": "",
                                              "bairro_destinatario": "Paracatuzinho",
                                              "valor_nota_fiscal": "",
                                              "cep_destinatario": "38603266",
                                              "descricao_objeto": "",
                                              "valor_a_cobrar": "0,0"
                                          },
                                          "data_postagem_sara": "20220110",
                                          "cubagem": "0,00",
                                          "servico_adicional": {
                                              "codigo_servico_adicional": {
                                                  "0": "25"
                                              }
                                          },
                                          "destinatario": {
                                              "complemento_destinatario": "",
                                              "numero_end_destinatario": "325",
                                              "telefone_destinatario": "",
                                              "email_destinatario": "",
                                              "cpf_cnpj_destinatario": "",
                                              "nome_destinatario": "Edivania Alves Pires ",
                                              "celular_destinatario": "",
                                              "logradouro_destinatario": "Rua Júlio Wilson Batista"
                                          },
                                          "restricao_anac": "",
                                          "dimensao_objeto": {
                                              "dimensao_diametro": "0.0",
                                              "dimensao_altura": "11.0",
                                              "dimensao_comprimento": "30.0",
                                              "tipo_objeto": "2",
                                              "dimensao_largura": "24.0"
                                          },
                                          "rt1": "",
                                          "valor_cobrado": "62.26",
                                          "rt2": "",
                                          "numero_comprovante_postagem": "2209140810",
                                          "numero_etiqueta": "OS634016638BR",
                                          "status_processamento": "1",
                                          "codigo_servico_postagem": "03220",
                                          "peso": "456"
                                      },
                                      "versao_arquivo": "2.3",
                                      "plp": {
                                          "nome_unidade_postagem": "AGF JOAQUIM TAVORA",
                                          "valor_global": "62.26",
                                          "mcu_unidade_postagem": "425057",
                                          "cartao_postagem": "0075832801",
                                          "id_plp": "610456273"
                                      },
                                      "remetente": {
                                          "numero_diretoria": "50",
                                          "email_remetente": "josejonas123@gmail.com",
                                          "complemento_remetente": "",
                                          "celular_remetente": "",
                                          "numero_contrato": "9912504122",
                                          "uf_remetente": "CE",
                                          "telefone_remetente": "",
                                          "cep_remetente": "60140050",
                                          "cidade_remetente": "Fortaleza",
                                          "numero_remetente": "88",
                                          "fax_remetente": "",
                                          "codigo_administrativo": "20295111",
                                          "ciencia_conteudo_proibido": "S",
                                          "cpf_cnpj_remetente": "10988581400",
                                          "bairro_remetente": "Aldeota",
                                          "nome_remetente": "Stara Modas ",
                                          "logradouro_remetente": "Rua Jaguaretama"
                                      },
                                      "forma_pagamento": ""
                                  },
                                  "percent_of_total": 13,
                                  "home_delivery": true,
                                  "subtotal": 62.26,
                                  "has_observation": false,
                                  "date": "2022/01/10",
                                  "discount_amount": 20.35,
                                  "bonus": 0,
                                  "saturday_delivery": false,
                                  "total_with_discount": 70.35,
                                  "has_error": false
                              },
                              "completed_at": "2022-01-10T14:37:20.754Z"
                          }
                      ],
                      "risk": "high",
                      "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido.",
                      "clearsaleScore": 4.74
                  },
                  "startedAt": 1751395500624,
                  "status": "success",
                  "output": {
                      "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
                      "risk": "high",
                      "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido.",
                      "clearsaleScore": 4.74,
                      "reported": true
                  },
                  "endedAt": 1751395502419
              }
          },
          "activePaths": [],
          "serializedStepGraph": [
              {
                  "type": "step",
                  "step": {
                      "id": "lookup-user-and-order"
                  }
              },
              {
                  "type": "step",
                  "step": {
                      "id": "fetch-last-orders"
                  }
              },
              {
                  "type": "step",
                  "step": {
                      "id": "agent-antifraud-analysis"
                  }
              },
              {
                  "type": "step",
                  "step": {
                      "id": "risk-branch"
                  }
              },
              {
                  "type": "step",
                  "step": {
                      "id": "gather-clearsale-data"
                  }
              },
              {
                  "type": "step",
                  "step": {
                      "id": "clearsale-verification"
                  }
              },
              {
                  "type": "step",
                  "step": {
                      "id": "reporting"
                  }
              }
          ],
          "suspendedPaths": {},
          "result": {
              "uid": "muYEhT5cHKSnhEDU2oUenI2UztD2",
              "risk": "high",
              "reason": "1. Conta criada em 2022-01-07, com o primeiro pedido completado em 2022-01-10, ou seja, pedido feito dentro de 40 dias da criação da conta, o que é um fator de risco.\n2. Histórico de 6 cálculos de sucesso e apenas 4 pedidos completados, indicando uma taxa de conversão baixa, o que pode sugerir comportamento de teste ou não genuíno.\n3. Um pedido de alto valor (R$528,12) foi feito com cartão de crédito e outro pedido de valor considerável (R$239,88) foi cancelado, o que pode indicar padrão fraudulento de cancelar pedidos caros e usar créditos para pedidos menores.\n4. Uso repetido do mesmo cartão de crédito (Mastercard expirando em 11/2023) em múltiplos pedidos, o que pode indicar tentativa de maximizar uso de um cartão possivelmente comprometido.\n5. Email principal é do Gmail, mas o email lead tem domínio estranho e email não verificado, o que pode indicar tentativa de ocultar identidade.\n6. Não há indicação de saldo negativo no dispositivo, o que evita risco crítico, mas os outros fatores combinados elevam o risco para alto.\n7. Endereços de origem e destino variam bastante, mas não há discrepância clara de geolocalização IP versus endereço.\n\nDado o conjunto de fatores, o risco é alto e recomenda-se investigação adicional antes da liberação do pedido.",
              "clearsaleScore": 4.74,
              "reported": true
          },
          "timestamp": 1751395502479
      },
      "createdAt": "2025-07-01T18:44:35.313Z",
      "updatedAt": "2025-07-01T18:45:02.484Z",
      "resourceId": null
  }


    
    const store = getStore(c);

    const workflow = await store.getWorkflowRunById({
      runId: instanceId,
      workflowName,
    });

    return workflow;
  },
});

export const deleteWorkflow = createTool({
  name: "HOSTING_APP_WORKFLOWS_DELETE",
  description:
    "Permanently delete a workflow from the workspace. DO NOT USE THIS TO STOP A WORKFLOW.",
  inputSchema: z.object({
    workflowName: z.string().describe("The name of the workflow"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe(
      "Whether the workflow was deleted successfully",
    ),
  }),
  handler: async ({ workflowName }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const env = getEnv(c);

    await c.cf.workflows.delete(workflowName, {
      account_id: env.CF_ACCOUNT_ID,
    });

    return { success: true };
  },
});
