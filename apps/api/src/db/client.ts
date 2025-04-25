import { createServerClient } from "@supabase/ssr";
import { getEnv } from "../utils/context.ts";

const supabaseUrl = getEnv("SUPABASE_URL");
const supabaseKey = getEnv("SUPABASE_SERVER_TOKEN");

export const createSupabaseClient = (
  opts: Parameters<typeof createServerClient>[2],
) => createServerClient(supabaseUrl, supabaseKey, opts);

export const supabase = createServerClient(supabaseUrl, supabaseKey, {
  cookies: { getAll: () => [] },
});
