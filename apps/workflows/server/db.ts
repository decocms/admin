import {
  drizzle,
  migrateWithoutTransaction,
} from "@deco/workers-runtime/drizzle";
import type { Env } from "./main";
import migrations from "../drizzle/migrations";

export const getDb = async (env: Env) => {
  const query = async ({ sql, params }: { sql: string; params: string[] }) => {
    const { result } = await env.DATABASE.DATABASES_RUN_SQL({
      sql,
      params,
    });
    return { result };
  };
  const db = drizzle({
    DECO_WORKSPACE_DB: {
      forContext: () => {
        return {
          query,
        };
      },
      query,
    },
  });
  await migrateWithoutTransaction(db, migrations);
  return db;
};
