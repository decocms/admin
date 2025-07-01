import { type Binding, WorkersMCPBindings } from "@deco/workers-runtime";
import type { SettingGetResponse } from "cloudflare/resources/workers-for-platforms/dispatch/namespaces/scripts";
import { assertHasWorkspace } from "../assertions.ts";
import { type AppContext, getEnv } from "../context.ts";
import { assertsDomainOwnership } from "./custom-domains.ts";
import { polyfill } from "./fs-polyfill.ts";
import { isDoBinding, migrationDiff } from "./migrations.ts";

const METADATA_FILE_NAME = "metadata.json";
export interface MigrationBase {
  tag: string;
}

export interface NewClassMigration extends MigrationBase {
  new_classes: string[];
}

export interface DeletedClassMigration extends MigrationBase {
  deleted_classes: string[];
}

export interface RenamedClassMigration extends MigrationBase {
  renamed_classes: {
    from: string;
    to: string;
  }[];
}

export type Migration =
  | NewClassMigration
  | DeletedClassMigration
  | RenamedClassMigration;

export interface KVNamespace {
  binding: string;
  id: string;
}

export interface Triggers {
  crons: string[];
}

export interface Route {
  pattern: string;
  custom_domain?: boolean;
}

export interface WranglerConfig {
  name: string;
  main?: string;
  main_module?: string;
  routes?: Route[];
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
  hyperdrive?: { binding: string; id: string; localConnectionString: string }[];
  d1_databases?: {
    database_name: string;
    database_id?: string;
    binding: string;
  }[];
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
    class_name?: string;
    script_name?: string;
  }[];
  migrations?: Migration[];
  //
  deco?: {
    bindings?: Binding[];
  };
}
// Common types and utilities
export type DeployResult = {
  etag?: string;
  id?: string;
};
const CUSTOM_HOSTNAME_POST_BODY = {
  "ssl": {
    "bundle_method": "ubiquitous" as const,
    "method": "http" as const,
    "type": "dv" as const,
    "settings": {
      "ciphers": [
        "ECDHE-RSA-AES128-GCM-SHA256",
        "AES128-SHA",
      ],
      "early_hints": "on" as const,
      "http2": "on" as const,
      "min_tls_version": "1.2" as const,
      "tls_1_3": "on" as const,
    },
    "wildcard": false as const,
  },
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

const DECO_CHAT_WORKSPACE_DB_BINDING_NAME = "DECO_CHAT_WORKSPACE_DB";
const workspaceD1Database = async (
  c: AppContext,
  bindings: SettingGetResponse["bindings"],
  d1Databases: { type: "d1"; name: string; id: string }[],
): Promise<{ type: "d1"; name: string; id: string }[]> => {
  assertHasWorkspace(c);
  const env = getEnv(c);
  const workspace = c.workspace.value;

  // Slugify workspace name to meet D1 naming requirements (lowercase letters, numbers, underscores, hyphens)
  const dbName = workspace.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

  // Check if D1 workspace binding already exists in current bindings
  const existingD1Binding = bindings?.find(
    (binding) =>
      binding.type === "d1" &&
      binding.name === DECO_CHAT_WORKSPACE_DB_BINDING_NAME,
  );

  let databaseId: string | undefined;

  if (existingD1Binding && "id" in existingD1Binding) {
    // Use existing database
    databaseId = existingD1Binding.id;
  } else {
    // Create new D1 database
    try {
      const createResult = await c.cf.d1.database.create({
        account_id: env.CF_ACCOUNT_ID,
        name: dbName,
      });
      databaseId = createResult.uuid;
    } catch (err) {
      const isConflict = typeof err === "object" && err && "status" in err &&
        typeof err.status === "number" && err.status === 409;
      if (!isConflict) {
        throw err;
      }
      // If database already exists (409 conflict), try to find it
      const databases = await c.cf.d1.database.list({
        account_id: env.CF_ACCOUNT_ID,
      });
      const existingDb = databases.result?.find((db) => db.name === dbName);
      if (!existingDb) {
        throw new Error(`Failed to create or find D1 database: ${dbName}`);
      }
      databaseId = existingDb.uuid;
    }
  }
  if (!databaseId) {
    throw new Error(`Failed to create or find D1 database: ${dbName}`);
  }

  const workspaceBinding = {
    type: "d1" as const,
    name: DECO_CHAT_WORKSPACE_DB_BINDING_NAME,
    id: databaseId,
  };

  // Check if binding already exists in d1Databases array
  const bindingExists = d1Databases.some(
    (db) =>
      db.name === DECO_CHAT_WORKSPACE_DB_BINDING_NAME && db.id === databaseId,
  );

  if (bindingExists) {
    return [];
  }

  return [workspaceBinding];
};

export async function deployToCloudflare(
  c: AppContext,
  {
    name: scriptSlug,
    compatibility_flags,
    compatibility_date,
    vars,
    kv_namespaces,
    hyperdrive,
    deco,
    ai,
    browser,
    durable_objects,
    queues,
    workflows,
    routes,
    triggers,
    d1_databases,
    migrations,
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
  const zoneId = env.CF_ZONE_ID;
  if (!zoneId) {
    throw new Error("CF_ZONE_ID is not set");
  }

  await Promise.all(
    (routes ?? []).map((route) =>
      route.custom_domain &&
      assertsDomainOwnership(route.pattern, scriptSlug).then(() => {
        if (!env.CF_ZONE_ID) {
          return;
        }
        return c.cf.customHostnames.create({
          hostname: route.pattern,
          zone_id: zoneId,
          ...CUSTOM_HOSTNAME_POST_BODY,
        }).catch((err) => {
          if (err.status === 409) {
            // fine, domain already exists
            return;
          }
          throw err;
        });
      })
    ),
  );

  const decoBindings = deco?.bindings ?? [];
  if (decoBindings.length > 0) {
    envVars["DECO_CHAT_BINDINGS"] = WorkersMCPBindings.stringify(decoBindings);
  }

  const { bindings } = await c.cf
    .workersForPlatforms
    .dispatch.namespaces
    .scripts.settings.get(env.CF_DISPATCH_NAMESPACE, scriptSlug, {
      account_id: env.CF_ACCOUNT_ID,
    }).catch(() => ({
      bindings: [],
    }));

  const doMigrations = migrationDiff(
    migrations ?? [],
    (bindings ?? []).filter(isDoBinding),
  );

  const d1Databases = d1_databases?.map((d1) => ({
    type: "d1" as const,
    name: d1.binding,
    id: d1.database_id!,
  })) ?? [];

  d1Databases.push(...await workspaceD1Database(c, bindings, d1Databases));
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
      name: workflow.binding,
      workflow_name: workflow.name,
      class_name: workflow.class_name,
      script_name: workflow.script_name,
    })) ?? [],
    ...d1Databases,
    ...hyperdrive?.map((hd) => ({
      type: "hyperdrive" as const,
      name: hd.binding,
      id: hd.id,
      localConnectionString: hd.localConnectionString,
    })) ?? [],
  ];

  const metadata = {
    main_module: mainModule,
    compatibility_flags: compatibility_flags ?? ["nodejs_compat"],
    compatibility_date: compatibility_date ?? "2024-11-27",
    tags: [c.workspace.value],
    bindings: wranglerBindings,
    triggers,
    observability: {
      enabled: true,
    },
    migrations: doMigrations,
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
