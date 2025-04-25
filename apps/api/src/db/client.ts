import { createClient } from "@supabase/supabase-js";
import { getEnv } from "../utils.ts";

const supabaseUrl = getEnv("SUPABASE_URL");
const supabaseKey = getEnv("SUPABASE_SERVER_TOKEN");

export const supabase = createClient(supabaseUrl, supabaseKey);
