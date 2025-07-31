import { WebCache } from "../../cache/index.ts";
import {
  type AppContext,
  assertHasWorkspace,
  assertsNotNull,
} from "../index.ts";

const cache = new WebCache<string>(
  "workspace-d1-database",
  WebCache.MAX_SAFE_TTL,
);
const inMemoryCache = new Map<string, string>();

export const getWorkspaceD1Database = async (
  c: AppContext,
): Promise<string> => {
  assertHasWorkspace(c);
  const cacheKey = `${c.workspace.value}-d1-database`;
  const inMemory = inMemoryCache.get(cacheKey);
  if (inMemory) {
    return inMemory;
  }
  const cached = await cache.get(cacheKey);
  if (cached) {
    inMemoryCache.set(cacheKey, cached);
    return cached;
  }
  const db = await assertsWorkspaceD1Database(c);
  assertsNotNull(db.uuid);
  inMemoryCache.set(cacheKey, db.uuid);
  await cache.set(cacheKey, db.uuid);
  return db.uuid;
};
const assertsWorkspaceD1Database = async (c: AppContext) => {
  assertHasWorkspace(c);
  const workspace = c.workspace.value;

  // Slugify workspace name to meet D1 naming requirements (lowercase letters, numbers, underscores, hyphens)
  const dbName = workspace.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

  // List databases to check if it already exists
  const databases = await c.cf.d1.database.list({
    account_id: c.envVars.CF_ACCOUNT_ID,
  });

  const existingDb = databases.result?.find((db) => db.name === dbName);

  if (existingDb) {
    // Database already exists, return
    return existingDb;
  }

  // Database doesn't exist, create it
  return await c.cf.d1.database.create({
    account_id: c.envVars.CF_ACCOUNT_ID,
    name: dbName,
  });
};
