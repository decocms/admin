import { createClient } from "@deco/workers-runtime/client";
import type { Env } from "shared/deco.gen.ts";

type SelfMCP = Env["SELF"];

export const client = createClient<SelfMCP>();
