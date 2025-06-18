import { type Binding, WorkersMCPBindings } from "@deco/workers-runtime";
import { parse as parseToml } from "toml";
import { z } from "zod";
import { NotFoundError, UserInputError } from "../../errors.ts";
import type { Database } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createTool, getEnv } from "../context.ts";
import { bundler } from "./bundler.ts";
import { polyfill } from "./fs-polyfill.ts";

const SCRIPT_FILE_NAME = "script.mjs";
const HOSTING_APPS_DOMAIN = ".deco.page";
const METADATA_FILE_NAME = "metadata.json";
export const Entrypoint = {
  host: (appSlug: string) => {
    return `${appSlug}${HOSTING_APPS_DOMAIN}`;
  },
  build: (appSlug: string) => {
    return `https://${Entrypoint.host(appSlug)}`;
  },
  script: (domain: string) => {
    return domain.split(HOSTING_APPS_DOMAIN)[0];
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

// Common types and utilities
type DeployResult = {
  etag?: string;
  id?: string;
};
export interface Polyfill {
  fileName: string;
  aliases: string[];
  content: string;
}

const addPolyfills = (
  files: Record<string, File>,
  metadata: Record<string, unknown>,
  polyfills: Polyfill[],
) => {
  const aliases: Record<string, string> = {};
  metadata.alias = aliases;

  for (const polyfill of polyfills) {
    const filePath = `${polyfill.fileName}.mjs`;
    files[filePath] ??= new File(
      [polyfill.content],
      filePath,
      {
        type: "application/javascript+module",
      },
    );

    for (const alias of polyfill.aliases) {
      aliases[alias] = `./${polyfill.fileName}`;
    }
  }
};
async function deployToCloudflare(
  c: AppContext,
  {
    name: scriptSlug,
    compatibility_flags,
    compatibility_date,
    vars,
    kv_namespaces,
    deco,
    ai,
    browser,
    durable_objects,
    queues,
    workflows,
    triggers,
    ...rest
  }: WranglerConfig,
  mainModule: string,
  files: Record<string, File>,
  _envVars?: Record<string, string>,
): Promise<DeployResult> {
  assertHasWorkspace(c);
  const env = getEnv(c);
  const envVars = {
    ..._envVars,
    ...vars,
  };
  const wranglerBindings = [
    ...kv_namespaces?.map((kv) => ({
      type: "kv_namespace" as const,
      name: kv.binding,
      namespace_id: kv.id,
    })) ?? [],
    ...ai ? [{ type: "ai" as const, name: ai.binding }] : [],
    ...browser ? [{ type: "browser" as const, name: browser.binding }] : [],
    ...durable_objects?.bindings?.map((binding) => ({
      type: "durable_object_namespace" as const,
      name: binding.name,
      class_name: binding.class_name,
    })) ?? [],
    ...queues?.producers?.map((producer) => ({
      type: "queue" as const,
      queue_name: producer.queue,
      name: producer.binding,
    })) ?? [],
    ...workflows?.map((workflow) => ({
      type: "workflow" as const,
      name: workflow.name,
      workflow_name: workflow.name,
      binding: workflow.binding,
      class_name: workflow.class_name,
    })) ?? [],
  ];
  const decoBindings = deco?.bindings ?? [];
  if (decoBindings.length > 0) {
    envVars["DECO_CHAT_BINDINGS"] = WorkersMCPBindings.stringify(decoBindings);
  }
  const metadata = {
    ...rest,
    main_module: mainModule,
    compatibility_flags: compatibility_flags ?? ["nodejs_compat"],
    compatibility_date: compatibility_date ?? "2024-11-27",
    tags: [c.workspace.value],
    bindings: wranglerBindings,
    triggers,
  };

  addPolyfills(files, metadata, [polyfill]);

  const body = {
    metadata: new File([JSON.stringify(metadata)], METADATA_FILE_NAME, {
      type: "application/json",
    }),
    ...files,
  };

  const result = await c.cf.workersForPlatforms.dispatch.namespaces
    .scripts.update(
      env.CF_DISPATCH_NAMESPACE,
      scriptSlug,
      {
        account_id: env.CF_ACCOUNT_ID,
        metadata,
      },
      {
        method: "put",
        body,
      },
    );

  if (envVars) {
    const promises = [];
    for (const [key, value] of Object.entries(envVars)) {
      promises.push(
        c.cf.workersForPlatforms.dispatch.namespaces.scripts.secrets.update(
          env.CF_DISPATCH_NAMESPACE,
          scriptSlug,
          {
            account_id: env.CF_ACCOUNT_ID,
            name: key,
            text: value,
            type: "secret_text",
          },
        ),
      );
    }
    await Promise.all(promises);
  }
  return {
    etag: result.etag,
    id: result.id,
  };
}

async function updateDatabase(
  c: AppContext,
  workspace: string,
  scriptSlug: string,
  result: DeployResult,
  files?: Record<string, string>,
) {
  // Try to update first
  const { data: updated, error: updateError } = await c.db
    .from(DECO_CHAT_HOSTING_APPS_TABLE)
    .update({
      updated_at: new Date().toISOString(),
      cloudflare_script_hash: result.etag,
      cloudflare_worker_id: result.id,
      files,
    })
    .eq("slug", scriptSlug)
    .select("*")
    .single();

  if (updateError && updateError.code !== "PGRST116") { // PGRST116: Results contain 0 rows
    throw updateError;
  }

  if (updated) {
    return Mappers.toApp(updated);
  }

  // If not updated, insert
  const { data: inserted, error: insertError } = await c.db
    .from(DECO_CHAT_HOSTING_APPS_TABLE)
    .insert({
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

  return Mappers.toApp(inserted);
}

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

export interface KVNamespace {
  binding: string;
  id: string;
}
export interface Triggers {
  crons: string[];
}
export interface WranglerConfig {
  name: string;
  main?: string;
  main_module?: string;
  compatibility_date?: string;
  compatibility_flags?: string[];
  vars?: Record<string, string>;
  kv_namespaces?: KVNamespace[];
  triggers?: Triggers;
  //
  ai?: {
    binding: string;
  };
  browser?: {
    binding: string;
  };
  durable_objects?: {
    bindings?: { name: string; class_name: string }[];
  };
  queues?: {
    consumers?: {
      queue: string;
      max_batch_timeout: number;
    }[];
    producers?: {
      queue: string;
      binding: string;
    }[];
  };
  workflows?: {
    name: string;
    binding: string;
    class_name: string;
  }[];
  //
  deco?: {
    bindings?: Binding[];
  };
}

const DECO_WORKER_RUNTIME_VERSION = "0.1.1";
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

export default withRuntime({
  fetch: async (request: Request, env: any) => {
    return new Response("Hello from Deno on Cloudflare!");
  }
});

You must use the Workers for Platforms TOML format for wrangler.toml. The [[bindings]] array supports all standard binding types (ai, analytics_engine, assets, browser_rendering, d1, durable_object_namespace, hyperdrive, kv_namespace, mtls_certificate, plain_text, queue, r2_bucket, secret_text, service, tail_consumer, vectorize, version_metadata, etc). For Deco-specific bindings, use type = "MCP".

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
      main = "main.ts"

      [triggers]
      crons = [ "*/3 * * * *", "0 15 1 * *", "59 23 LW * *" ]

      [[bindings]]
      type = "kv_namespace"
      name = "KV_NAME"
      namespace_id = "KV_ID"
      namespace_id = "KV_ID"

      [[bindings]]
      type = "MCP"
      name = "MY_BINDING"
      integration_id = "INTEGRATION_ID"
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
  }),
  outputSchema: z.object({
    entrypoint: z.string(),
    id: z.string(),
    workspace: z.string(),
  }),
  handler: async ({ appSlug: _appSlug, files, envVars }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    // Convert array to record for bundler
    const filesRecord = files.reduce((acc, file) => {
      acc[file.path] = file.content;
      return acc;
    }, {} as Record<string, string>);

    const wranglerFile = CONFIGS.find((file) => file in filesRecord);
    const wranglerConfig: WranglerConfig = wranglerFile
      ? parseToml(filesRecord[wranglerFile])
      : { name: _appSlug };

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

    // Bundle the files
    const bundledScript = await bundler(filesRecord, entrypoint);

    const fileObjects = {
      [SCRIPT_FILE_NAME]: new File(
        [bundledScript],
        SCRIPT_FILE_NAME,
        {
          type: "application/javascript+module",
        },
      ),
    };

    const appEnvVars = {
      DECO_CHAT_WORKSPACE: workspace,
      DECO_CHAT_SCRIPT_SLUG: scriptSlug,
    };

    const result = await deployToCloudflare(
      c,
      wranglerConfig,
      SCRIPT_FILE_NAME,
      fileObjects,
      { ...envVars, ...appEnvVars },
    );
    const data = await updateDatabase(
      c,
      workspace,
      scriptSlug,
      result,
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
