import { createServerClient } from "@supabase/ssr";
import { getEnv } from "../utils/context.ts";
import type { Database } from "./schema.ts";

const supabaseUrl = getEnv("SUPABASE_URL");
const supabaseKey = getEnv("SUPABASE_SERVER_TOKEN");

/**
 * Uses the tokens present on the request to create a client.
 * This means it will only have access to the tables the user has access to.
 *
 * DO NOT use this, since this is very slow. Please use the server client below.
 */
export const createSupabaseClient = (
  opts: Parameters<typeof createServerClient>[2],
) => createServerClient(supabaseUrl, supabaseKey, opts);

/**
 * This client uses the server token to access the database,
 * so before accessing anything, make sure the user has the correct permissions.
 */
export const client = createServerClient<Database, "public">(
  supabaseUrl,
  supabaseKey,
  { cookies: { getAll: () => [] } },
);
