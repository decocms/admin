import { createClient } from "@deco/workers-runtime/client";
import type { Env } from "../../../server/deco.gen.ts";

type SelfMCP = Env["SELF"];

export const client = createClient<SelfMCP>();
