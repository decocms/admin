import { z } from "zod";
import { Database } from "../../db/schema.ts";
import { AppContext, createApiHandler, getEnv } from "../../utils/context.ts";

const HOSTING_APPS_DOMAIN = ".deco.page";
export const Entrypoint = {
  build: (appSlug: string) => {
    return `https://${appSlug}${HOSTING_APPS_DOMAIN}`;
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

const DeployAppSchema = z.object({
  appSlug: z.string(), // defaults to 'default'
  script: z.string(),
});

const DECO_CHAT_HOSTING_APPS_TABLE = "deco_chat_hosting_apps" as const;

type AppRow =
  Database["public"]["Tables"][typeof DECO_CHAT_HOSTING_APPS_TABLE]["Row"];
export type App = z.infer<typeof AppSchema>;

const Mappers = {
  toApp: (data: AppRow): App & { id: string; workspace: string } => {
    return {
      id: data.id,
      slug: data.slug,
      entrypoint: Entrypoint.build(data.slug),
      workspace: data.workspace,
    };
  },
};

function getWorkspaceParams(c: AppContext, appSlug?: string) {
  const root = c.req.param("root");
  const wksSlug = c.req.param("slug");
  const workspace = `${root}/${wksSlug}`;
  const slug = appSlug ?? wksSlug;
  return { root, wksSlug, workspace, slug };
}

// 1. List apps for a given workspace
export const listApps = createApiHandler({
  name: "HOSTING_APPS_LIST",
  description: "List all apps for the current tenant",
  schema: z.object({}),
  handler: async (_, c) => {
    const { workspace } = getWorkspaceParams(c);

    const { data, error } = await c.var.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .select("*")
      .eq("workspace", workspace);

    if (error) throw error;

    return data.map(Mappers.toApp);
  },
});

let created = false;
const createNamespaceOnce = async (c: AppContext) => {
  if (created) return;
  created = true;
  const cf = c.var.cf;
  const env = getEnv(c);
  await cf.workersForPlatforms.dispatch.namespaces.create({
    name: env.CF_DISPATCH_NAMESPACE,
    account_id: env.CF_ACCOUNT_ID,
  }).catch(() => {});
};
// 2. Create app (on demand, e.g. on first deploy)
export const deployApp = createApiHandler({
  name: "HOSTING_APP_DEPLOY",
  description:
    "Create a new app script for the given workspace. It should follow a javascript-only module that implements fetch api using export default { fetch (req) { return new Response('Hello, world!') } }",
  schema: DeployAppSchema,
  handler: async ({ appSlug, script }, c) => {
    await createNamespaceOnce(c);
    const { workspace, slug: scriptSlug } = getWorkspaceParams(c, appSlug);
    // Use the fixed dispatcher namespace
    const env = getEnv(c);

    const scriptFileName = "script.mjs";
    const metadata = {
      main_module: scriptFileName,
      compatibility_flags: ["nodejs_compat"],
      compatibility_date: "2024-11-27",
    };

    const body = {
      metadata: new File([JSON.stringify(metadata)], "metadata.json", {
        type: "application/json",
      }),
      [scriptFileName]: new File([script], scriptFileName, {
        type: "application/javascript+module",
      }),
    };

    // 2. Create or update the script under the fixed namespace
    await c.var.cf.workersForPlatforms.dispatch.namespaces.scripts.update(
      env.CF_DISPATCH_NAMESPACE,
      scriptSlug,
      {
        account_id: env.CF_ACCOUNT_ID,
        metadata: {
          main_module: scriptFileName,
          compatibility_flags: ["nodejs_compat"],
        },
      },
      {
        method: "put",
        body,
      },
    );
    // 1. Try to update first
    const { data: updated, error: updateError } = await c.var.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("slug", scriptSlug)
      .select("*")
      .single();

    if (updateError && updateError.code !== "PGRST116") { // PGRST116: Results contain 0 rows
      throw updateError;
    }

    if (updated) {
      // Row existed and was updated
      return Mappers.toApp(updated);
    }

    // 2. If not updated, insert
    const { data: inserted, error: insertError } = await c.var.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .insert({
        workspace,
        slug: scriptSlug,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    return Mappers.toApp(inserted);
  },
});

// 3. Delete app (and worker)
export const deleteApp = createApiHandler({
  name: "HOSTING_APP_DELETE",
  description: "Delete an app and its worker",
  schema: AppInputSchema,
  handler: async ({ appSlug }, c) => {
    const cf = c.var.cf;
    const { workspace, slug: scriptSlug } = getWorkspaceParams(c, appSlug);
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
    const { error: dbError } = await c.var.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .delete()
      .eq("workspace", workspace)
      .eq("slug", scriptSlug);

    if (dbError) throw dbError;

    return { success: true };
  },
});

// 4. Get app info (metadata, endpoint, etc)
export const getAppInfo = createApiHandler({
  name: "HOSTING_APP_INFO",
  description: "Get info/metadata for an app (including endpoint)",
  schema: AppInputSchema,
  handler: async ({ appSlug }, c) => {
    const { workspace, slug } = getWorkspaceParams(c, appSlug);
    const entrypoint = Entrypoint.build(slug);
    const env = getEnv(c);
    // 1. Fetch from DB
    const { data, error } = await c.var.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .select("*")
      .eq("workspace", workspace)
      .eq("slug", slug)
      .single();

    if (error || !data) {
      throw new Error("App not found");
    }

    const cf = c.var.cf;
    const namespace = env.CF_DISPATCH_NAMESPACE;
    const content = await cf.workersForPlatforms.dispatch.namespaces.scripts
      .content.get(
        namespace,
        slug,
        { account_id: env.CF_ACCOUNT_ID },
      );

    return {
      app: slug,
      entrypoint,
      content: await content.blob(),
    };
  },
});
