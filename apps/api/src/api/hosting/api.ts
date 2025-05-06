import { z } from "zod";
import { Database } from "../../db/schema.ts";
import { createApiHandler } from "../../utils/context.ts";
import { slugify } from "../../utils/slugify.ts";

const DISPATCHER_NAMESPACE = "deco-chat-prod";

const HOSTING_APPS_DOMAIN = ".deco.page";
export const Entrypoint = {
  domain: (
    appSlug: string,
    root: string,
    urlCompatibleWorkspaceSlug: string,
  ) => {
    const prefix = root === "user" ? "u-" : "";
    const slug = appSlug === "default" ? "" : `${appSlug}--`;
    return `https://${prefix}${slug}${urlCompatibleWorkspaceSlug}${HOSTING_APPS_DOMAIN}`;
  },
  build: (appSlug: string, workspace: string) => {
    const [root, workspaceSlug] = workspace.split("/");
    const urlCompatibleWorkspaceSlug = slugify(workspaceSlug);
    return {
      url: Entrypoint.domain(appSlug, root, urlCompatibleWorkspaceSlug),
      slug: urlCompatibleWorkspaceSlug,
    };
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
  toApp: (data: AppRow): App & { id: string } => {
    return {
      id: data.id,
      slug: data.slug,
      entrypoint: Entrypoint.build(data.slug, data.workspace).url,
    };
  },
};

// 1. List apps for a given workspace
export const listApps = createApiHandler({
  name: "HOSTING_APPS_LIST",
  description: "List all apps for the current tenant",
  schema: z.object({}),
  handler: async (_, c) => {
    const workspace = c.req.param("slug");

    const { data, error } = await c.var.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .select("*")
      .eq("workspace", workspace);

    if (error) throw error;

    return data.map(Mappers.toApp);
  },
});

// 2. Create app (on demand, e.g. on first deploy)
export const deployApp = createApiHandler({
  name: "HOSTING_APP_DEPLOY",
  description:
    "Create a new app script for the given workspace. It should follow a javascript-only module that implements fetch api using export default { fetch (req) { return new Response('Hello, world!') } }",
  schema: DeployAppSchema,
  handler: async ({ appSlug, script }, c) => {
    const cf = c.var.cf;
    const root = c.req.param("root");
    const wksSlug = c.req.param("slug");
    const workspace = `${root}/${wksSlug}`;
    const scriptSlug = appSlug ?? "default";
    const { url: entrypoint, slug } = Entrypoint.build(scriptSlug, workspace);
    // Use the fixed dispatcher namespace
    const namespace = DISPATCHER_NAMESPACE;
    const scriptName = `${slug}.mjs`;

    // Update updated_at for upsert semantics
    const { error: upsertError } = await c.var.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .upsert({ workspace, slug, updated_at: new Date().toISOString() })
      .eq("workspace", workspace)
      .eq("slug", slug);

    if (upsertError) throw upsertError;

    const formData = new FormData();
    formData.append(
      "script",
      new File([script], scriptName, {
        type: "application/javascript+module",
      }),
    );

    // 2. Create or update the script under the fixed namespace
    await cf.workersForPlatforms.dispatch.namespaces.scripts.update(
      namespace,
      scriptName,
      {
        account_id: c.env.CF_ACCOUNT_ID,
        metadata: {
          main_module: scriptName,
          compatibility_flags: ["nodejs_compat"],
        },
      },
      {
        method: "put",
        body: formData,
      },
    );

    // Return app info
    return { app: slug, entrypoint };
  },
});

// 3. Delete app (and worker)
export const deleteApp = createApiHandler({
  name: "HOSTING_APP_DELETE",
  description: "Delete an app and its worker",
  schema: AppInputSchema,
  handler: async ({ appSlug }, c) => {
    const cf = c.var.cf;
    const root = c.req.param("root");
    const wksSlug = c.req.param("slug");
    const workspace = `${root}/${wksSlug}`;
    const scriptSlug = appSlug ?? "default";
    const { slug } = Entrypoint.build(scriptSlug, workspace);
    const namespace = DISPATCHER_NAMESPACE;
    const scriptName = `${slug}.mjs`;

    // 1. Delete worker script from Cloudflare
    try {
      await cf.workersForPlatforms.dispatch.namespaces.scripts.delete(
        namespace,
        scriptName,
        {
          account_id: c.env.CF_ACCOUNT_ID,
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
      .eq("slug", slug);

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
    const root = c.req.param("root");
    const wksSlug = c.req.param("slug");
    const workspace = `${root}/${wksSlug}`;
    const scriptSlug = appSlug ?? "default";
    const { url: entrypoint, slug } = Entrypoint.build(scriptSlug, workspace);

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
    const namespace = DISPATCHER_NAMESPACE;
    const scriptName = `${slug}.mjs`;
    const content = await cf.workersForPlatforms.dispatch.namespaces.scripts
      .content.get(
        namespace,
        scriptName,
        { account_id: c.env.CF_ACCOUNT_ID },
      );

    return {
      app: slug,
      entrypoint,
      content: await content.blob(),
    };
  },
});
